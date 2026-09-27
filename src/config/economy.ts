// Wirtschafts-Config – Balancing passiert ausschließlich hier (und in config/life.ts für Bewohner & Müll).
// Alle Beträge in Münzen, alle Raten pro Stunde.

import type { PlotSize } from "../model/types";

export interface PlotSizeConfig {
  /** Breite des Grundstücks in Kacheln. */
  tiles: number;
  /** Startpreis in Münzen (vor Preisanstieg). */
  price: number;
  /**
   * Plätze eines Gebäudes auf Stufe 1: Bewohner (Wohnhaus) bzw. Kunden, die ein Laden bedienen kann.
   * Ein Laden braucht so viele Bewohner in der Straße, um ausgelastet zu sein.
   */
  capacity: number;
  /** Laufende Kosten eines Gebäudes (Hausmeister, Steuer, Wartung) pro Stunde auf Stufe 1. */
  upkeepPerHour: number;
  /** Maximale Stockwerke der Fassade. */
  maxFloors: 1 | 2 | 3;
}

export interface UpgradeLevelConfig {
  /** Mehr Plätze und mehr Kosten auf dieser Stufe (1.5 = +50 %). */
  multiplier: number;
  /** Kosten für den Aufstieg auf diese Stufe, als Anteil des Grundstückpreises. */
  costFactor: number;
}

export const ECONOMY = {
  startCoins: 1000,
  /** Größe des geschenkten Start-Grundstücks. */
  giftPlotSize: "S" as PlotSize,

  plotsPerSide: 6,
  plotSizes: {
    S: { tiles: 1, price: 500, capacity: 4, upkeepPerHour: 12, maxFloors: 1 },
    M: { tiles: 2, price: 1500, capacity: 10, upkeepPerHour: 40, maxFloors: 2 },
    L: { tiles: 3, price: 4000, capacity: 24, upkeepPerHour: 96, maxFloors: 3 },
  } satisfies Record<PlotSize, PlotSizeConfig>,

  /** Miete je Bewohner pro Stunde. Volles S-Wohnhaus ohne Deko: 4 × 12 = 48/Std. */
  rentPerResidentPerHour: 12,
  /** Umsatz eines Ladens je belegtem Kundenplatz pro Stunde. Voller S-Laden ohne Deko: 4 × 16 = 64/Std. */
  revenuePerCustomerPerHour: 16,
  /** Laufende Kosten eines Spielplatzes pro Stunde. */
  playgroundUpkeepPerHour: 8,

  /** Preisanstieg je gekauftem Grundstück (0.15 = +15 %) – zählt über alle Straßen. */
  plotPriceIncrease: 0.15,

  /** Länger als so viele Stunden weg: die Zeit darüber hinaus wird nicht mehr gerechnet (die Welt pausiert). */
  maxOfflineHours: 14 * 24,

  /** Standard-Bonus je verbautem Deko-Teil (+5 % Miete), übernommen als `rentBonus` im Teile-Katalog. */
  decoRentBonus: 0.05,
  /** Miet-Bonus je zusätzlichem Stockwerk über dem Erdgeschoss (+20 %). */
  floorRentBonus: 0.2,

  upgradeLevels: {
    1: { multiplier: 1, costFactor: 0 },
    2: { multiplier: 1.5, costFactor: 0.5 },
    3: { multiplier: 2.2, costFactor: 1 },
  } satisfies Record<1 | 2 | 3, UpgradeLevelConfig>,

  /** Spielstände aus der Zeit vor Bewohnern & Kosten: Guthaben wird einmalig auf höchstens so viel gekürzt. */
  legacyCoinsCap: 2000,
  /** Früher gekaufte Grundstücke in fremden Straßen werden erstattet: Grundpreis × damaliger Aufpreis. */
  legacyNeighborRefundFactor: 1.25,
} as const;

/**
 * Version der Spielregeln (ältere Stände werden in game/migrate.ts umgestellt):
 * 2 = Bewohner & laufende Kosten, 3 = Kaufen nur noch in der eigenen Straße.
 */
export const CURRENT_ECONOMY = 3;

/** Aktueller Kaufpreis eines Grundstücks, nachdem schon `plotsBought` Grundstücke gekauft wurden. */
export function plotPrice(size: PlotSize, plotsBought: number): number {
  const base = ECONOMY.plotSizes[size].price;
  return Math.round(base * (1 + ECONOMY.plotPriceIncrease) ** plotsBought);
}

/** Kosten, um ein Gebäude auf `targetLevel` zu heben. */
export function upgradeCost(plotBasePrice: number, targetLevel: 2 | 3): number {
  return Math.round(plotBasePrice * ECONOMY.upgradeLevels[targetLevel].costFactor);
}

/** Plätze (Bewohner bzw. Kunden) eines Gebäudes. */
export function capacityOf(size: PlotSize, level: 1 | 2 | 3): number {
  return Math.round(ECONOMY.plotSizes[size].capacity * ECONOMY.upgradeLevels[level].multiplier);
}

/** Laufende Kosten eines Gebäudes pro Stunde. */
export function upkeepOf(size: PlotSize, level: 1 | 2 | 3): number {
  return ECONOMY.plotSizes[size].upkeepPerHour * ECONOMY.upgradeLevels[level].multiplier;
}

/** Mietniveau durch die Fassade: 1 + Deko-Boni + Stockwerke (z. B. 2 Deko-Teile, 2 Stockwerke = 1,3). */
export function rentLevel(floors: 1 | 2 | 3, partsBonus: number): number {
  return 1 + partsBonus + (floors - 1) * ECONOMY.floorRentBonus;
}
