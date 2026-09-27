import { describe, expect, it } from "vitest";
import { capacityOf, plotPrice, rentLevel, upgradeCost, upkeepOf } from "./economy";

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

  it("Plätze und Kosten wachsen mit Größe und Stufe", () => {
    expect([capacityOf("S", 1), capacityOf("M", 1), capacityOf("L", 1)]).toEqual([4, 10, 24]);
    expect(capacityOf("M", 2)).toBe(15);
    expect(capacityOf("L", 3)).toBe(53);
    expect(upkeepOf("S", 1)).toBe(12);
    expect(upkeepOf("L", 3)).toBeCloseTo(96 * 2.2);
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
