import { plotPrice, upgradeCost } from "../config/economy";
import type { Building, Player, Plot, Street } from "../model/types";
import { cleanBuildingName } from "./names";

export const isOwned = (plot: Plot) => plot.purchasedAt !== undefined;

/** Anzahl gekaufter Grundstücke (Geschenke zählen nicht). */
export function plotsBought(street: Street): number {
  return street.plots.filter((p) => isOwned(p) && !p.gifted).length;
}

/** Aktueller Kaufpreis dieses Grundstücks inkl. Preisanstieg. */
export function currentPrice(street: Street, plot: Plot): number {
  return plotPrice(plot.size, plotsBought(street));
}

export type BuyResult =
  | { ok: true; player: Player; street: Street; price: number }
  | { ok: false; reason: "not-found" | "owned" | "too-expensive" };

export function buyPlot(player: Player, street: Street, plotId: string, now: number): BuyResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot) return { ok: false, reason: "not-found" };
  if (isOwned(plot)) return { ok: false, reason: "owned" };
  const price = currentPrice(street, plot);
  if (player.coins < price) return { ok: false, reason: "too-expensive" };

  return {
    ok: true,
    price,
    player: { ...player, coins: player.coins - price },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, purchasedAt: now } : p)) },
  };
}

/** Stellt ein Gebäude auf ein eigenes Grundstück (ersetzt ein vorhandenes, Upgrade-Stufe bleibt erhalten). */
export function placeBuilding(street: Street, plotId: string, building: Building): Street | null {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot || !isOwned(plot)) return null;
  const placed = plot.building ? { ...building, level: plot.building.level } : building;
  return { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building: placed } : p)) };
}

export type UpgradeResult =
  | { ok: true; player: Player; street: Street; cost: number }
  | { ok: false; reason: "not-found" | "no-building" | "max-level" | "too-expensive" };

/** Nächste Upgrade-Stufe eines Gebäudes und ihre Kosten (Anteil des Grundstückpreises). */
export function nextUpgrade(plot: Plot): { level: 2 | 3; cost: number } | null {
  if (!plot.building || plot.building.level >= 3) return null;
  const level = (plot.building.level + 1) as 2 | 3;
  return { level, cost: upgradeCost(plot.price, level) };
}

export function upgradePlot(player: Player, street: Street, plotId: string): UpgradeResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot || !isOwned(plot)) return { ok: false, reason: "not-found" };
  if (!plot.building) return { ok: false, reason: "no-building" };
  const next = nextUpgrade(plot);
  if (!next) return { ok: false, reason: "max-level" };
  if (player.coins < next.cost) return { ok: false, reason: "too-expensive" };
  const building = { ...plot.building, level: next.level };
  return {
    ok: true,
    cost: next.cost,
    player: { ...player, coins: player.coins - next.cost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building } : p)) },
  };
}

/** Benennt das Gebäude auf einem eigenen Grundstück um. */
export function renameBuilding(street: Street, plotId: string, name: string): Street | null {
  const plot = street.plots.find((p) => p.id === plotId);
  const clean = cleanBuildingName(name);
  if (!plot || !isOwned(plot) || !plot.building || !clean) return null;
  const building = { ...plot.building, name: clean };
  return { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building } : p)) };
}
