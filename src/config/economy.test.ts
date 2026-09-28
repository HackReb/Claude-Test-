import { describe, expect, it } from "vitest";
import { capacityOf, plotPrice, rentFactorOf, rentLevel, upgradeCost, upkeepOf } from "./economy";

describe("economy", () => {
  it("Startpreise laut Konzept", () => {
    expect(plotPrice("S", 0)).toBe(500);
    expect(plotPrice("M", 0)).toBe(1500);
    expect(plotPrice("L", 0)).toBe(4000);
  });

  it("Preis steigt um 15 % je gekauftem Grundstück", () => {
    expect(plotPrice("S", 1)).toBe(575);
    expect(plotPrice("S", 2)).toBe(661);
  });

  it("Läden: Plätze und Kosten wachsen mit Größe und Stufe", () => {
    expect([capacityOf("S", 1, "commercial"), capacityOf("M", 1, "commercial"), capacityOf("L", 1, "commercial")]).toEqual([4, 10, 24]);
    expect(capacityOf("M", 2, "commercial")).toBe(15);
    expect(capacityOf("L", 3, "commercial")).toBe(53);
    expect(upkeepOf("S", 1, "commercial")).toBe(12);
    expect(upkeepOf("L", 3, "commercial")).toBeCloseTo(96 * 2.2);
  });

  it("Wohnhäuser: Modernisieren bringt keine zusätzlichen Wohnungen, aber mehr Miete je Bewohner", () => {
    expect([1, 2, 3].map((level) => capacityOf("M", level as 1 | 2 | 3, "residential"))).toEqual([10, 10, 10]);
    expect(rentFactorOf(1, "residential")).toBe(1);
    expect(rentFactorOf(3, "residential")).toBeGreaterThan(rentFactorOf(2, "residential"));
    expect(rentFactorOf(3, "commercial")).toBe(1);
    expect(upkeepOf("S", 2, "residential")).toBeGreaterThan(upkeepOf("S", 1, "residential"));
    expect(upkeepOf("S", 2, "residential")).toBeLessThan(upkeepOf("S", 2, "commercial"));
  });

  it("Mietniveau: 1 + Deko + Stockwerke", () => {
    expect(rentLevel(1, 0)).toBe(1);
    expect(rentLevel(2, 0.1)).toBeCloseTo(1.3);
  });

  it("Upgrade-Kosten 50 % / 100 % des Grundstückpreises", () => {
    expect(upgradeCost(1500, 2)).toBe(750);
    expect(upgradeCost(1500, 3)).toBe(1500);
  });
});
