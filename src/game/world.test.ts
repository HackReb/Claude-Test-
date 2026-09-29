import { describe, expect, it } from "vitest";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { buyPlot, placeBuilding, upgradePlot } from "./plots";
import { buildingFromTemplate, TEMPLATES } from "./templates";
import { digestOf, distanceKm, nearbyStreets, sameStreet, streetNameKey, streetNews } from "./world";

const tpl = (id: string) => buildingFromTemplate(TEMPLATES.find((t) => t.id === id)!);
const at = (lat: number, lon: number) => ({ key: `osm|${lat}|${lon}`, wayId: "W1", lat, lon });

function streetOf(name: string, city: string, osm?: ReturnType<typeof at>) {
  return claimStreet({ playerName: name, street: { name: `${name}straße`, city, ...(osm && { osm }) } }, 0);
}

describe("Nachbarn in der Nähe", () => {
  it("rechnet Entfernungen in km", () => {
    expect(distanceKm({ lat: 47.98, lon: 8.8 }, { lat: 47.98, lon: 8.8 })).toBe(0);
    // ~1 km nach Norden
    expect(distanceKm({ lat: 47.98, lon: 8.8 }, { lat: 47.989, lon: 8.8 })).toBeCloseTo(1, 1);
  });

  it("nächste zuerst, zu weit weg fliegt raus, ohne Koordinaten zählt der Ort", () => {
    const kalle = streetOf("Kalle", "Tuttlingen", at(47.98, 8.8)).street;
    const maxim = streetOf("Maxim", "Tuttlingen", at(47.982, 8.8)).street; // ~200 m
    const zoe = streetOf("Zoe", "Tuttlingen", at(47.995, 8.8)).street; // ~1,7 km
    const weit = streetOf("Weit", "Tuttlingen", at(48.2, 8.8)).street; // ~24 km
    const ohne = streetOf("Ohne", "tuttlingen").street;
    const anderswo = streetOf("Anders", "Ulm").street;
    expect(nearbyStreets(kalle, [ohne, zoe, weit, maxim, anderswo, kalle]).map((s) => s.name)).toEqual([
      "Maximstraße",
      "Zoestraße",
      "Ohnestraße",
    ]);
  });
});

describe("Neuigkeiten von Mitspielern", () => {
  const kalle = streetOf("Kalle", "Tuttlingen");
  const maxim = streetOf("Maxim", "Tuttlingen");
  const names = { [kalle.player.id]: "Kalle", [maxim.player.id]: "Maxim" };
  const free = (street: Street) => street.plots.find((p) => p.purchasedAt === undefined && p.size === "M")!;

  it("beim ersten Sehen nur merken, danach Kauf, Bau und Ausbau melden", () => {
    let street = maxim.street;
    expect(streetNews(undefined, street, { me: kalle.player.id, names, at: 5 })).toEqual([]);
    const before = digestOf(street);

    const plot = free(street);
    const bought = buyPlot({ ...maxim.player, coins: 1e6 }, street, plot.id, 1);
    if (!bought.ok) throw new Error();
    street = placeBuilding(bought.street, plot.id, tpl("wohnhaus"))!;
    const news = streetNews(before, street, { me: kalle.player.id, names, at: 5 });
    expect(news).toEqual([
      { playerName: "Maxim", streetId: street.id, at: 5, text: "Maxim hat in der Maximstraße ein Grundstück gekauft und „Wohnhaus“ gebaut." },
    ]);

    const upgraded = upgradePlot({ ...maxim.player, coins: 1e6 }, street, plot.id);
    if (!upgraded.ok) throw new Error();
    expect(streetNews(digestOf(street), upgraded.street, { me: kalle.player.id, names, at: 6 }).map((n) => n.text)).toEqual([
      "Maxim hat „Wohnhaus“ auf Stufe 2 ausgebaut.",
    ]);
  });

  it("wer in meiner Straße kauft, taucht auf – meine eigenen Änderungen nicht", () => {
    const before = digestOf(kalle.street);
    // Alter Stand: Maxim hatte früher bei Kalle gekauft
    const plot = free(kalle.street);
    const bought = { ...kalle.street, plots: kalle.street.plots.map((p) => (p.id === plot.id ? { ...p, purchasedAt: 1, ownerId: maxim.player.id } : p)) };
    expect(streetNews(before, bought, { me: kalle.player.id, names, at: 7 }).map((n) => n.text)).toEqual([
      "Maxim hat in deiner Straße ein M-Grundstück gekauft.",
    ]);
    // Kalle baut selbst → keine Neuigkeit
    const own = kalle.street.plots.find((p) => p.gifted)!;
    const rebuilt = placeBuilding(kalle.street, own.id, tpl("imbiss"))!;
    expect(streetNews(before, rebuilt, { me: kalle.player.id, names, at: 8 })).toEqual([]);
  });
});

describe("dieselbe Straße", () => {
  const street = (name: string, city: string, key?: string) =>
    ({ id: name, name, city, ownerId: "x", plots: [], ...(key && { osm: { key, wayId: "W1", lat: 0, lon: 0 } }) }) as unknown as Street;
  it("erkennt Schreibweisen und Karten-Kennung", () => {
    expect(streetNameKey("Bahnhof-Str.")).toBe(streetNameKey("Bahnhofstraße"));
    expect(sameStreet(street("Bahnhofstr", "Tuttlingen"), street("Bahnhofstraße", " tuttlingen"))).toBe(true);
    expect(sameStreet(street("Bahnhofstraße", "Ulm"), street("Bahnhofstraße", "Tuttlingen"))).toBe(false);
    expect(sameStreet(street("A", "X", "osm|1"), street("B", "Y", "osm|1"))).toBe(true);
  });
});
