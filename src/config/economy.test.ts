import { describe, expect, it } from "vitest";
import { ECONOMY, creditedMinutes, plotPrice, rentPerMinute, upgradeCost } from "./economy";

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

  it("Miete: Basis × (1 + Deko + Stockwerke) × Upgrade", () => {
    expect(rentPerMinute({ size: "S", floors: 1, partsBonus: 0, level: 1 })).toBe(10);
    expect(rentPerMinute({ size: "M", floors: 2, partsBonus: 0.1, level: 1 })).toBeCloseTo(30 * 1.3);
    expect(rentPerMinute({ size: "L", floors: 3, partsBonus: 0, level: 3 })).toBeCloseTo(90 * 1.4 * 2.2);
  });

  it("Upgrade-Kosten 50 % / 100 % des Grundstückpreises", () => {
    expect(upgradeCost(1500, 2)).toBe(750);
    expect(upgradeCost(1500, 3)).toBe(1500);
  });

  it("Offline-Zeit wird auf 8 h gedeckelt", () => {
    expect(creditedMinutes(0, 30 * 60_000)).toBe(30);
    expect(creditedMinutes(0, 24 * 60 * 60_000)).toBe(ECONOMY.maxOfflineMinutes);
    expect(creditedMinutes(1000, 0)).toBe(0);
  });
});
