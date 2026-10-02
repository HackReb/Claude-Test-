import { describe, expect, it } from "vitest";
import { INVENT } from "../config/items";
import type { Shop, ShopItem } from "../model/types";
import { figureOf, inventionsLeft, itemIncomePerHour, outfitOf, residentPick, showcaseOf, wardrobe, wear, wornDesigns } from "./figure";

const item = (id: string, price: number, showcase = true): ShopItem => ({
  id,
  name: id,
  description: "",
  design: { slot: "hat", shape: "cap", colors: ["#f00", "#fff", "#000"], pattern: "plain" },
  price,
  showcase,
  createdAt: 0,
  sold: 0,
});
const shop = (id: string, items: ShopItem[]): Shop => ({ id, memberId: "m1", type: "hats", name: id, look: 0, openedAt: 0, data: { items } });

describe("Figur", () => {
  it("hat ohne Angaben ein festes Aussehen und Grundkleidung", () => {
    const a = figureOf({ id: "x" });
    expect(figureOf({ id: "x" })).toEqual(a);
    expect(a.worn.top?.id).toMatch(/^starter:/);
    expect(Object.keys(wornDesigns(a))).toEqual(expect.arrayContaining(["top", "legs", "feet"]));
    expect(figureOf({ id: "y" }).base).not.toEqual(a.base);
  });

  it("zieht Sachen an und aus, Karte zeigt die Herkunft", () => {
    const hat = { id: "o1", name: "Krone", design: { slot: "hat" as const, shape: "crown", colors: ["#ffd166", "#fff", "#000"] as [string, string, string], pattern: "plain" as const }, shopId: "s1", shopName: "Kronen-Kalle" };
    const dressed = wear(figureOf({ id: "x" }), "hat", hat);
    expect(wornDesigns(dressed).hat?.shape).toBe("crown");
    expect(outfitOf({ id: "x", figure: dressed })[0]).toMatchObject({ slot: "hat", name: "Krone", shopName: "Kronen-Kalle" });
    expect(wear(dressed, "hat", null).worn.hat).toBeUndefined();
    // Ein Stück am falschen Platz wird nicht gezeichnet.
    const wrong = wear(dressed, "feet", hat);
    expect(wornDesigns(wrong).feet).toBeUndefined();
  });

  it("Schrank: Grund-Teile plus Gekauftes je Platz", () => {
    const closet = wardrobe([{ id: "o1", itemId: "w1", shopId: "s1", shopName: "Laden", name: "Krone", design: { slot: "hat", shape: "crown", colors: ["#f00", "#fff", "#000"], pattern: "plain" }, price: 10, boughtAt: 0 }]);
    expect(closet.hat.map((i) => i.name)).toContain("Krone");
    expect(closet.top.length).toBeGreaterThan(2);
    expect(closet.ride).toEqual([]);
  });

  it("Bewohner tragen Schaufenster-Waren fest und bevorzugt günstige", () => {
    const street = { shops: [shop("s1", [item("cheap", 10), item("dear", 5000), item("hidden", 10, false)])] };
    const showcase = showcaseOf(street);
    expect(showcase.map((s) => s.item.id)).toEqual(["cheap", "dear"]);
    expect(residentPick("npc1", [])).toBeNull();
    const counts = { cheap: 0, dear: 0, none: 0 };
    for (let i = 0; i < 400; i++) {
      const pick = residentPick(`npc${i}`, showcase);
      counts[(pick?.item.id as "cheap" | "dear") ?? "none"]++;
      expect(residentPick(`npc${i}`, showcase)).toEqual(pick);
    }
    expect(counts.cheap).toBeGreaterThan(counts.dear * 3);
    expect(counts.none).toBeGreaterThan(50);
  });

  it("Schaufenster-Waren bringen Umsatz durch Bewohner", () => {
    expect(itemIncomePerHour(shop("s1", []), 40)).toBe(0);
    const cheap = itemIncomePerHour(shop("s1", [item("a", 50)]), 40);
    const dear = itemIncomePerHour(shop("s1", [item("a", 800)]), 40);
    expect(cheap).toBeGreaterThan(0);
    expect(dear).toBeGreaterThan(cheap);
    expect(itemIncomePerHour(shop("s1", [item("a", 50, false)]), 40)).toBe(0);
  });

  it("zählt Erfindungen je Tag", () => {
    const now = Date.UTC(2026, 9, 2, 12);
    expect(inventionsLeft({ data: {} }, now)).toBe(INVENT.perDay);
    expect(inventionsLeft({ data: { invented: { day: "2026-10-02", count: 3 } } }, now)).toBe(INVENT.perDay - 3);
    expect(inventionsLeft({ data: { invented: { day: "2026-10-01", count: 5 } } }, now)).toBe(INVENT.perDay);
  });
});
