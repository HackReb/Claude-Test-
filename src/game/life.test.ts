import { describe, expect, it } from "vitest";
import { LIFE } from "../config/life";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { addLitter, buildPlayground, residentVoices, rentModifiers, spawnLitter, streetStats, tapLitter, useOf } from "./life";
import { buyPlot, placeBuilding } from "./plots";
import { streetRentPerMinute } from "./rent";
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

describe("Miete je nach Straße", () => {
  it("Gewerbe verdient mehr mit Wohnhäusern (Kundschaft)", () => {
    const s = start();
    const kioskOnly = streetRentPerMinute(s.street);
    const withHome = withPlot(s, "M", "wohnhaus");
    expect(rentModifiers(withHome.street).customerBonus).toBeCloseTo(LIFE.customerBonusPerHome);
    const kioskRent = kioskOnly * (1 + LIFE.customerBonusPerHome);
    expect(streetRentPerMinute(withHome.street)).toBeGreaterThan(kioskRent);
  });

  it("Spielplatz: kostet Münzen, nur auf leerem eigenen Grundstück, Wohnhäuser zahlen mehr", () => {
    const s = start();
    const home = withPlot(s, "M", "wohnhaus");
    const rentBefore = streetRentPerMinute(home.street);
    const empty = withPlot({ player: home.player, street: home.street }, "S");
    const built = buildPlayground({ ...empty.player, coins: 1000 }, empty.street, empty.plotId);
    if (!built.ok) throw new Error(built.reason);
    expect(built.player.coins).toBe(1000 - LIFE.playgroundCost);
    expect(streetStats(built.street).playgrounds).toBe(1);
    expect(streetRentPerMinute(built.street)).toBeGreaterThan(rentBefore);
    expect(buildPlayground({ ...empty.player, coins: 10 }, empty.street, empty.plotId)).toEqual({ ok: false, reason: "too-expensive" });
    expect(buildPlayground(built.player, built.street, empty.plotId)).toEqual({ ok: false, reason: "not-allowed" });
    // Ein Gebäude ersetzt den Spielplatz
    const replaced = placeBuilding(built.street, empty.plotId, tpl("kiosk"))!;
    expect(replaced.plots.find((p) => p.id === empty.plotId)?.amenity).toBeUndefined();
  });

  it("Dreck senkt die Miete, höchstens um 40 %", () => {
    const { street } = start();
    const clean = streetRentPerMinute(street);
    let dirty: Street = street;
    for (let i = 0; i < 3; i++) dirty = addLitter(dirty, "trash", { pos: 0.5, side: "top" });
    expect(streetRentPerMinute(dirty)).toBeCloseTo(clean * (1 - 3 * LIFE.litterRentPenalty));
    for (let i = 0; i < 20; i++) dirty = addLitter(dirty, "poop", { pos: 0.2, side: "bottom" });
    expect(dirty.litter).toHaveLength(LIFE.maxLitter);
    expect(streetRentPerMinute(dirty)).toBeCloseTo(clean * (1 - LIFE.maxLitterPenalty));
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
    const withHomes = { ...withPlot(start(), "L", "gummibaerchenschloss").street, id: "mithunden" };
    const many = [1, 2, 3].reduce((st) => withPlot({ player: start().player, street: st }, "M", "wohnhaus").street, withHomes);
    expect(spawnLitter({ ...many, id: "mithunden" }, 24 * HOUR).litter!.some((l) => l.kind === "poop")).toBe(true);
  });

  it("Müll ist mit einem Tipp weg, Hundehaufen brauchen drei – mit Belohnung", () => {
    let street = addLitter(addLitter(start().street, "trash", { pos: 0.1, side: "top" }), "poop", { pos: 0.3, side: "top" });
    const [trash, poop] = street.litter!;
    const t = tapLitter(street, trash.id)!;
    expect(t).toMatchObject({ cleaned: true, reward: LIFE.cleanReward.trash });
    street = t.street;
    expect(tapLitter(street, poop.id)).toMatchObject({ cleaned: false, reward: 0 });
    street = tapLitter(street, poop.id)!.street;
    street = tapLitter(street, poop.id)!.street;
    const last = tapLitter(street, poop.id)!;
    expect(last).toMatchObject({ cleaned: true, reward: LIFE.cleanReward.poop });
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
    let dirty = home.street;
    for (let i = 0; i < LIFE.dirtyThreshold; i++) dirty = addLitter(dirty, "trash", { pos: 0.4, side: "top" });
    const complaint = residentVoices(dirty).find((v) => v.id === "dirty")!;
    expect(complaint.effect).toContain("−12 %");
  });

  it("zufriedene Bewohner mit Spielplatz und sauberer Straße", () => {
    const home = withPlot(start(), "M", "wohnhaus");
    const empty = withPlot({ player: home.player, street: home.street }, "S");
    const built = buildPlayground({ ...empty.player, coins: 1000 }, empty.street, empty.plotId);
    if (!built.ok) throw new Error();
    expect(residentVoices(built.street).map((v) => v.id)).toEqual(["happy"]);
  });
});
