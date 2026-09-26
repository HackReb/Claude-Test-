// Wirtschafts-Config – alle Zahlen aus KONZEPT-Strassen-Game.md, Abschnitt 5 + 8.
// Balancing passiert ausschließlich hier.

import type { PlotSize } from "../model/types";

export interface PlotSizeConfig {
  /** Breite des Grundstücks in Kacheln. */
  tiles: number;
  /** Startpreis in Münzen (vor Preisanstieg). */
  price: number;
  /** Basismiete in Münzen pro Minute. */
  baseRentPerMinute: number;
  /** Maximale Stockwerke der Fassade. */
  maxFloors: 1 | 2 | 3;
}

export interface UpgradeLevelConfig {
  /** Miet-Multiplikator dieser Stufe. */
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
    S: { tiles: 1, price: 500, baseRentPerMinute: 10, maxFloors: 1 },
    M: { tiles: 2, price: 1500, baseRentPerMinute: 30, maxFloors: 2 },
    L: { tiles: 3, price: 4000, baseRentPerMinute: 90, maxFloors: 3 },
  } satisfies Record<PlotSize, PlotSizeConfig>,

  /** Preisanstieg je gekauftem Grundstück (0.15 = +15 %). */
  plotPriceIncrease: 0.15,

  /** Maximal angerechnete Offline-Zeit in Minuten (8 h). */
  maxOfflineMinutes: 8 * 60,

  /** Bonus je verbautem Deko-Teil (+5 %). */
  decoRentBonus: 0.05,
  /** Bonus je zusätzlichem Stockwerk über dem Erdgeschoss (+20 %). */
  floorRentBonus: 0.2,

  upgradeLevels: {
    1: { multiplier: 1, costFactor: 0 },
    2: { multiplier: 1.5, costFactor: 0.5 },
    3: { multiplier: 2.2, costFactor: 1 },
  } satisfies Record<1 | 2 | 3, UpgradeLevelConfig>,
} as const;

/** Aktueller Kaufpreis eines Grundstücks, nachdem schon `plotsBought` Grundstücke gekauft wurden. */
export function plotPrice(size: PlotSize, plotsBought: number): number {
  const base = ECONOMY.plotSizes[size].price;
  return Math.round(base * (1 + ECONOMY.plotPriceIncrease) ** plotsBought);
}

/** Kosten, um ein Gebäude auf `targetLevel` zu heben. */
export function upgradeCost(plotBasePrice: number, targetLevel: 2 | 3): number {
  return Math.round(plotBasePrice * ECONOMY.upgradeLevels[targetLevel].costFactor);
}

export interface RentInput {
  size: PlotSize;
  floors: 1 | 2 | 3;
  decoCount: number;
  level: 1 | 2 | 3;
}

/** Miete pro Minute eines bebauten Grundstücks. */
export function rentPerMinute({ size, floors, decoCount, level }: RentInput): number {
  const base = ECONOMY.plotSizes[size].baseRentPerMinute;
  const bonus = 1 + decoCount * ECONOMY.decoRentBonus + (floors - 1) * ECONOMY.floorRentBonus;
  return base * bonus * ECONOMY.upgradeLevels[level].multiplier;
}

/** Angerechnete Minuten seit `lastSeen`, gedeckelt auf die maximale Offline-Zeit. */
export function creditedMinutes(lastSeen: number, now: number): number {
  const minutes = Math.max(0, (now - lastSeen) / 60_000);
  return Math.min(minutes, ECONOMY.maxOfflineMinutes);
}
