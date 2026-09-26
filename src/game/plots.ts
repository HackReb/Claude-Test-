import { plotPrice } from "../config/economy";
import type { Building, Player, Plot, Street } from "../model/types";

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
