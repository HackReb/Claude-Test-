import { creditedMinutes, rentPerMinute } from "../config/economy";
import type { Building, Player, Plot, PlotSize, Street } from "../model/types";
import { applyModifiers, rentModifiers, type RentModifiers } from "./life";
import { belongsTo } from "./plots";
import { getPart } from "../parts/catalog";

export function buildingRentPerMinute(size: PlotSize, building: Building): number {
  const { facade } = building;
  const partsBonus = [facade.base, facade.roof, ...facade.parts].reduce(
    (sum, ref) => sum + (getPart(ref.partId)?.rentBonus ?? 0),
    0,
  );
  return rentPerMinute({ size, floors: facade.floors, partsBonus, level: building.level });
}

/** Miete eines Grundstücks in seiner Straße – inklusive Sauberkeit, Spielplatz und Kundschaft. */
export function plotRentPerMinute(street: Street, plot: Plot, modifiers: RentModifiers = rentModifiers(street)): number {
  if (plot.purchasedAt === undefined || !plot.building) return 0;
  return applyModifiers(buildingRentPerMinute(plot.size, plot.building), plot.building, modifiers);
}

/** Miete pro Minute, die `ownerId` in dieser Straße verdient (Standard: der Besitzer der Straße). */
export function streetRentPerMinute(street: Street, ownerId: string = street.ownerId): number {
  const modifiers = rentModifiers(street);
  return street.plots.reduce(
    (sum, plot) => (belongsTo(street, plot, ownerId) ? sum + plotRentPerMinute(street, plot, modifiers) : sum),
    0,
  );
}

/** Gesamte Miete eines Spielers über alle Straßen (eigene + Grundstücke bei Nachbarn). */
export function playerRentPerMinute(streets: Street[], playerId: string): number {
  return streets.reduce((sum, s) => sum + streetRentPerMinute(s, playerId), 0);
}

/**
 * Verbucht die Miete seit `player.lastSeen` in `pendingRent` – aus allen Straßen, in denen er Grundstücke hat.
 * Lücken über der maximalen Offline-Zeit werden gedeckelt.
 */
export function accrueRent(player: Player, streets: Street | Street[], now: number): { player: Player; gained: number } {
  const all = Array.isArray(streets) ? streets : [streets];
  const gained = creditedMinutes(player.lastSeen, now) * playerRentPerMinute(all, player.id);
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
