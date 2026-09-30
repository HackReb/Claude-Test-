import { describe, expect, it } from "vitest";
import { LIFE } from "../config/life";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import {
  addLitter,
  buildPlayground,
  homeComfort,
  moveTowards,
  placesOf,
  residentsOf,
  residentVoices,
  spawnLitter,
  streetNeeds,
  streetStats,
  tapLitter,
  targetOccupancy,
  useOf,
} from "./life";
import { buyPlot, placeBuilding } from "./plots";
import { buildingFromTemplate, TEMPLATES } from "./templates";

const HOUR = 3_600_000;
const start = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);
const tpl = (id: string) => buildingFromTemplate(TEMPLATES.find((t) => t.id === id)!);

/** Kauft ein freies Grundstück der Größe und stellt ein Gebäude drauf (oder lässt es leer). */
function withPlot(state: ReturnType<typeof start>, size: "S" | "M" | "L", templateId?: string) {
  const plot = state.street.plots.find((p) => p.size === size && p.purchasedAt === undefined)!;
  const bought = buyPlot({ ...state.player, coins: 99_999 }, state.street, plot.id, 1);
  if (!bought.ok) throw new Error(bought.reason);
  const street = templateId ? placeBuilding(bought.street, plot.id, tpl(templateId))! : bought.street;
  return { player: bought.player, street, plotId: plot.id };
}

describe("Nutzung", () => {
  it("Vorlagen bringen ihre Nutzung mit, ältere Gebäude werden an der Fassade erkannt", () => {
    expect(tpl("kiosk").use).toBe("commercial");
    expect(tpl("wohnhaus").use).toBe("residential");
    const { use: _u, ...old } = tpl("kiosk");
    expect(useOf(old)).toBe("commercial"); // hat ein Schild
    const { use: _v, ...oldHome } = tpl("wohnhaus");
    expect(useOf(oldHome)).toBe("residential");
  });
});

describe("Wohlfühl-Liste und Bewohner", () => {
  it("Wohnhäuser werden nur voll mit sauberer Straße, Spielplatz und Laden", () => {
    const s = start(); // Kiosk = Laden
    const home = withPlot(s, "M", "wohnhaus");
    const needs = streetNeeds(home.street);
    expect(needs.map((n) => [n.id, n.met])).toEqual([
      ["clean", true],
      ["playground", false],
      ["shop", true],
    ]);
    expect(homeComfort(home.street)).toBeCloseTo(LIFE.noPlaygroundFactor);

    const empty = withPlot({ player: home.player, street: home.street }, "S");
    const built = buildPlayground({ ...empty.player, coins: 1000 }, empty.street, empty.plotId);
    if (!built.ok) throw new Error(built.reason);
    expect(homeComfort(built.street)).toBe(1);

    let dirty: Street = built.street;
    for (let i = 0; i < 20; i++) dirty = addLitter(dirty, "poop", { pos: 0.2, side: "bottom" });
    expect(dirty.litter).toHaveLength(LIFE.maxLitter);
    expect(homeComfort(dirty)).toBeCloseTo(Math.max(LIFE.minCleanliness, 1 - LIFE.maxLitter * LIFE.litterComfortLoss));
  });

  it("Läden brauchen Bewohner als Kundschaft, sonst nur Laufkundschaft", () => {
    const s = start();
    const kiosk = s.street.plots.find((p) => p.building)! as Parameters<typeof targetOccupancy>[1];
    expect(targetOccupancy(s.street, kiosk)).toBeCloseTo(LIFE.walkInCustomers);
    const home = withPlot(s, "M", "wohnhaus"); // 10 Plätze, ziehen erst ein
    const kioskThere = home.street.plots.find((p) => p.id === kiosk.id)! as typeof kiosk;
    expect(residentsOf(home.street)).toBeCloseTo(10 * LIFE.firstResidents);
    // 2,5 Bewohner für 4 Kiosk-Plätze: Laufkundschaft + 62,5 % vom Rest
    expect(targetOccupancy(home.street, kioskThere)).toBeCloseTo(LIFE.walkInCustomers + (1 - LIFE.walkInCustomers) * (2.5 / 4));
  });

  it("Spielplatz: kostet Münzen, nur auf leerem eigenen Grundstück, ein Gebäude ersetzt ihn", () => {
    const home = withPlot(start(), "M", "wohnhaus");
    const empty = withPlot({ player: home.player, street: home.street }, "S");
    const built = buildPlayground({ ...empty.player, coins: 1000 }, empty.street, empty.plotId);
    if (!built.ok) throw new Error(built.reason);
    expect(built.player.coins).toBe(1000 - LIFE.playgroundCost);
    expect(streetStats(built.street).playgrounds).toBe(1);
    expect(buildPlayground({ ...empty.player, coins: 10 }, empty.street, empty.plotId)).toEqual({ ok: false, reason: "too-expensive" });
    expect(buildPlayground(built.player, built.street, empty.plotId)).toEqual({ ok: false, reason: "not-allowed" });
    const replaced = placeBuilding(built.street, empty.plotId, tpl("kiosk"))!;
    expect(replaced.plots.find((p) => p.id === empty.plotId)?.amenity).toBeUndefined();
  });

  it("neue Häuser starten mit den ersten Mietern, Umbau behält die Bewohner", () => {
    const home = withPlot(start(), "M", "wohnhaus");
    const plot = home.street.plots.find((p) => p.id === home.plotId)!;
    expect(plot.building?.occupancy).toBe(LIFE.firstResidents);
    const full = { ...home.street, plots: home.street.plots.map((p) => (p.id === home.plotId ? { ...p, building: { ...p.building!, occupancy: 0.9 } } : p)) };
    const rebuilt = placeBuilding(full, home.plotId, tpl("wohnhaus"))!;
    expect(rebuilt.plots.find((p) => p.id === home.plotId)?.building?.occupancy).toBe(0.9);
    const shop = placeBuilding(full, home.plotId, tpl("kiosk"))!;
    expect(shop.plots.find((p) => p.id === home.plotId)?.building?.occupancy).toBe(LIFE.firstResidents);
  });

  it("Einziehen geht schneller als Ausziehen", () => {
    expect(moveTowards(0.2, 1, 0.1)).toBeCloseTo(0.2 + 0.1 * LIFE.moveInPerHour);
    expect(moveTowards(0.2, 1, 5)).toBe(1);
    expect(moveTowards(1, 0.2, 1)).toBeCloseTo(1 - LIFE.moveOutPerHour);
    expect(moveTowards(0.5, 0.52, 10)).toBe(0.52);
    expect(moveTowards(0.5, 0.48, 10)).toBe(0.48);
  });
});

describe("Müll", () => {
  it("entsteht offline je nach Läden und Wohnhäusern, reproduzierbar und gedeckelt", () => {
    // Feste ID: der Zufall hängt an Straßen-ID + Stunde
    const s = withPlot(start(), "M", "wohnhaus");
    const street = { ...s.street, id: "teststrasse" };
    const a = spawnLitter(street, 20 * HOUR);
    const b = spawnLitter(street, 20 * HOUR);
    expect(a.litter!.length).toBeGreaterThan(0);
    expect(a.litter!.map((l) => `${l.kind}${l.pos}`)).toEqual(b.litter!.map((l) => `${l.kind}${l.pos}`));
    expect(spawnLitter(street, 1000 * HOUR).litter!.length).toBeLessThanOrEqual(LIFE.maxLitter);
    // nichts doppelt nachwürfeln
    expect(spawnLitter(a, 20 * HOUR).litter).toEqual(a.litter);
  });

  it("Hundehaufen gibt es nur mit Wohnhäusern (Hunde), Müll auch durch Läden", () => {
    const kioskOnly = { ...start().street, id: "nurkiosk" };
    const litter = spawnLitter(kioskOnly, 24 * HOUR).litter!;
    expect(litter.length).toBeGreaterThan(0);
    expect(litter.every((l) => l.kind === "trash")).toBe(true);
    const castle = withPlot(start(), "L", "gummibaerchenschloss");
    const withHomes = { ...castle.street, id: "mithunden" };
    const many = [1, 2, 3].reduce((st) => withPlot({ player: castle.player, street: st }, "M", "wohnhaus").street, withHomes);
    expect(spawnLitter({ ...many, id: "mithunden" }, 24 * HOUR).litter!.some((l) => l.kind === "poop")).toBe(true);
  });

  it("Müll ist mit einem Tipp weg, Hundehaufen brauchen drei – mit Belohnung", () => {
    let street = addLitter(addLitter(start().street, "trash", { pos: 0.1, side: "top" }), "poop", { pos: 0.3, side: "top" });
    const [trash, poop] = street.litter!;
    const t = tapLitter(street, trash.id)!;
    expect(t).toMatchObject({ cleaned: true });
    expect(t).not.toHaveProperty("reward"); // Saubermachen bringt kein Geld
    street = t.street;
    expect(tapLitter(street, poop.id)).toMatchObject({ cleaned: false });
    street = tapLitter(street, poop.id)!.street;
    street = tapLitter(street, poop.id)!.street;
    const last = tapLitter(street, poop.id)!;
    expect(last).toMatchObject({ cleaned: true });
    expect(last.street.litter).toEqual([]);
    expect(tapLitter(last.street, "weg")).toBeNull();
  });
});

describe("Stimmen der Bewohner", () => {
  it("Kinder wünschen sich einen Spielplatz, Läden wünschen sich Kundschaft, Dreck nervt alle", () => {
    const s = start();
    expect(residentVoices(s.street).map((v) => v.id)).toEqual(["customers"]); // nur der Kiosk
    const home = withPlot(s, "M", "wohnhaus");
    const ids = residentVoices(home.street).map((v) => v.id);
    expect(ids).toContain("playground");
    expect(ids).not.toContain("customers");
    expect(ids).not.toContain("shop"); // der Kiosk ist ein Laden
    let dirty = home.street;
    for (let i = 0; i < LIFE.dirtyThreshold; i++) dirty = addLitter(dirty, "trash", { pos: 0.4, side: "top" });
    const complaint = residentVoices(dirty).find((v) => v.id === "dirty")!;
    expect(complaint.effect).toContain("79 %");
  });

  it("zufriedene Bewohner mit Spielplatz und sauberer Straße", () => {
    const home = withPlot(start(), "M", "wohnhaus");
    const empty = withPlot({ player: home.player, street: home.street }, "S");
    const built = buildPlayground({ ...empty.player, coins: 1000 }, empty.street, empty.plotId);
    if (!built.ok) throw new Error();
    expect(residentVoices(built.street).map((v) => v.id)).toEqual(["happy"]);
  });
});

describe("Modernisieren", () => {
  it("modernisierte Wohnhäuser verzeihen Dreck eher – gleich viele Wohnungen", () => {
    const { street, plotId } = withPlot(start(), "M", "wohnhaus");
    const dirty: Street = { ...street, litter: Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, kind: "trash" as const, pos: 0.1 * i, side: "top" as const, taps: 0 })) };
    const at = (level: 1 | 2 | 3) => {
      const s: Street = { ...dirty, plots: dirty.plots.map((p) => (p.id === plotId ? { ...p, building: { ...p.building!, level } } : p)) };
      const plot = s.plots.find((p) => p.id === plotId)! as Parameters<typeof targetOccupancy>[1];
      return { target: targetOccupancy(s, plot), places: placesOf(plot) };
    };
    expect(at(2).target).toBeGreaterThan(at(1).target);
    expect(at(3).target).toBeGreaterThan(at(2).target);
    expect(new Set([at(1).places, at(2).places, at(3).places]).size).toBe(1);
  });
});
