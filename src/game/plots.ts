import { plotPrice, upgradeCost } from "../config/economy";
import type { Building, Player, Plot, Street } from "../model/types";
import { LIFE } from "../config/life";
import { useOf } from "./life";
import { cleanBuildingName } from "./names";

/** Ist das Grundstück verkauft (egal an wen)? */
export const isOwned = (plot: Plot) => plot.purchasedAt !== undefined;

/** Gehört das Grundstück `ownerId` – als Besitzer der Straße oder als Käufer in einer fremden Straße? */
export function belongsTo(street: Street, plot: Plot, ownerId: string): boolean {
  if (!isOwned(plot)) return false;
  return plot.ownerId ? plot.ownerId === ownerId : street.ownerId === ownerId;
}

/** Anzahl gekaufter Grundstücke eines Spielers in allen Straßen (Geschenke zählen nicht). */
export function plotsBought(streets: Street[], playerId: string): number {
  return streets.reduce((sum, s) => sum + s.plots.filter((p) => belongsTo(s, p, playerId) && !p.gifted).length, 0);
}

/** Kaufpreis inkl. Preisanstieg je schon gekauftem Grundstück. */
export function currentPrice(streets: Street[], _street: Street, plot: Plot, playerId: string): number {
  return plotPrice(plot.size, plotsBought(streets, playerId));
}

export type BuyResult =
  | { ok: true; player: Player; street: Street; price: number }
  | { ok: false; reason: "not-found" | "owned" | "too-expensive" | "not-allowed" };

/**
 * Kauft ein freies Grundstück – nur in der eigenen Straße (in fremden Straßen kauft man nicht).
 * `price` ohne Angabe: Preis, als gäbe es nur diese eine Straße.
 */
export function buyPlot(player: Player, street: Street, plotId: string, now: number, price?: number): BuyResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot) return { ok: false, reason: "not-found" };
  if (street.ownerId !== player.id) return { ok: false, reason: "not-allowed" };
  if (isOwned(plot)) return { ok: false, reason: "owned" };
  const cost = price ?? currentPrice([street], street, plot, player.id);
  if (player.coins < cost) return { ok: false, reason: "too-expensive" };

  const bought: Plot = { ...plot, purchasedAt: now };
  return {
    ok: true,
    price: cost,
    player: { ...player, coins: player.coins - cost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? bought : p)) },
  };
}

/** Stellt ein Gebäude auf ein eigenes Grundstück (ersetzt ein vorhandenes, Upgrade-Stufe bleibt erhalten). */
export function placeBuilding(street: Street, plotId: string, building: Building): Street | null {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot || !isOwned(plot)) return null;
  // Umbau behält Stufe und – bei gleicher Nutzung – die Bewohner; ein neues Haus startet mit den ersten Mietern.
  const previous = plot.building;
  const keepsTenants = previous && useOf(previous) === useOf(building) && previous.occupancy !== undefined;
  const placed: Building = {
    ...building,
    level: previous?.level ?? building.level,
    occupancy: keepsTenants ? previous.occupancy : LIFE.firstResidents,
  };
  // Ein Gebäude ersetzt eine Anlage (z. B. Spielplatz) auf demselben Grundstück.
  const replace = ({ amenity: _removed, ...p }: Plot): Plot => ({ ...p, building: placed });
  return { ...street, plots: street.plots.map((p) => (p.id === plotId ? replace(p) : p)) };
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
