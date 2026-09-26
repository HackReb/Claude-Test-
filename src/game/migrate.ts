import type { Player, Street } from "../model/types";
import { starterKiosk } from "./templates";

/** Hebt Spielstände aus älteren Versionen auf den aktuellen Stand. */
export function migrateSave(player: Player, street: Street): { player: Player; street: Street } {
  // Stände aus M1: noch ohne Miet-Zähler, geschenktes Grundstück ohne Markierung und ohne Kiosk.
  if (player.pendingRent !== undefined) return { player, street };

  const owned = street.plots.filter((p) => p.purchasedAt !== undefined);
  const plots =
    owned.length === 1 && !owned[0].building
      ? street.plots.map((p) => (p === owned[0] ? { ...p, gifted: true, building: starterKiosk(player.name) } : p))
      : street.plots;
  return { player: { ...player, pendingRent: 0 }, street: { ...street, plots } };
}
