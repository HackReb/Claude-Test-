import { creditedMinutes, rentPerMinute } from "../config/economy";
import type { Building, Player, PlotSize, Street } from "../model/types";
import { getPart } from "../parts/catalog";

export function buildingRentPerMinute(size: PlotSize, building: Building): number {
  const { facade } = building;
  const partsBonus = [facade.base, facade.roof, ...facade.parts].reduce(
    (sum, ref) => sum + (getPart(ref.partId)?.rentBonus ?? 0),
    0,
  );
  return rentPerMinute({ size, floors: facade.floors, partsBonus, level: building.level });
}

/** Gesamte Miete pro Minute aller eigenen, bebauten Grundstücke. */
export function streetRentPerMinute(street: Street): number {
  return street.plots.reduce(
    (sum, plot) =>
      plot.purchasedAt !== undefined && plot.building ? sum + buildingRentPerMinute(plot.size, plot.building) : sum,
    0,
  );
}

/**
 * Verbucht die Miete seit `player.lastSeen` in `pendingRent`.
 * Lücken über der maximalen Offline-Zeit werden gedeckelt.
 */
export function accrueRent(player: Player, street: Street, now: number): { player: Player; gained: number } {
  const gained = creditedMinutes(player.lastSeen, now) * streetRentPerMinute(street);
  return {
    player: { ...player, pendingRent: player.pendingRent + gained, lastSeen: Math.max(player.lastSeen, now) },
    gained,
  };
}

/** Überträgt die ganzen Münzen aus `pendingRent` auf das Konto; Bruchteile bleiben stehen. */
export function collectRent(player: Player): { player: Player; collected: number } {
  const collected = Math.floor(player.pendingRent);
  return {
    player: { ...player, coins: player.coins + collected, pendingRent: player.pendingRent - collected },
    collected,
  };
}
