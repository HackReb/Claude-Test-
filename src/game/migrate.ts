import { CURRENT_ECONOMY, ECONOMY } from "../config/economy";
import type { Player, Street } from "../model/types";
import { starterKiosk } from "./templates";

/** Hebt Spielstände aus älteren Versionen auf den aktuellen Stand. */
export function migrateSave(player: Player, street: Street, now: number): { player: Player; street: Street } {
  let result = { player, street };

  // Stände aus M1: noch ohne Miet-Zähler, geschenktes Grundstück ohne Markierung und ohne Kiosk.
  if (result.player.pendingRent === undefined) {
    const owned = street.plots.filter((p) => p.purchasedAt !== undefined);
    const plots =
      owned.length === 1 && !owned[0].building
        ? street.plots.map((p) => (p === owned[0] ? { ...p, gifted: true, building: starterKiosk(player.name) } : p))
        : street.plots;
    result = { player: { ...result.player, pendingRent: 0 }, street: { ...street, plots } };
  }

  // Vor Bewohnern & Kosten gab es viel zu schnell viel zu viel Geld: Guthaben einmalig kürzen,
  // Gebäude und Grundstücke bleiben. Die Zeit bis jetzt wird nicht mehr nach neuen Regeln abgerechnet.
  if ((result.player.economy ?? 1) < CURRENT_ECONOMY) {
    const total = result.player.coins + Math.floor(result.player.pendingRent);
    result = {
      ...result,
      player: {
        ...result.player,
        coins: Math.min(total, ECONOMY.legacyCoinsCap),
        pendingRent: 0,
        lastSeen: Math.max(result.player.lastSeen, now),
        economy: CURRENT_ECONOMY,
      },
    };
  }
  return result;
}
