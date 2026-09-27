import { ECONOMY } from "../config/economy";
import type { Player, Plot, Street } from "../model/types";
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
  if ((result.player.economy ?? 1) < 2) {
    const total = result.player.coins + Math.floor(result.player.pendingRent);
    result = {
      ...result,
      player: {
        ...result.player,
        coins: Math.min(total, ECONOMY.legacyCoinsCap),
        pendingRent: 0,
        lastSeen: Math.max(result.player.lastSeen, now),
        economy: 2,
      },
    };
  }
  return result;
}

/**
 * Regeln v3: Man kauft nur noch in der eigenen Straße. Grundstücke, die der Spieler früher in fremden
 * Straßen gekauft hat, werden wieder frei – der Kaufpreis kommt zurück aufs Konto.
 */
export function releaseForeignPlots(player: Player, streets: Street[]): { player: Player; streets: Street[]; refund: number; released: number } {
  if ((player.economy ?? 1) >= 3) return { player, streets, refund: 0, released: 0 };
  let refund = 0;
  let released = 0;
  const free = ({ id, size, side, index, price }: Plot): Plot => ({ id, size, side, index, price });
  const updated = streets.map((street) => {
    if (street.ownerId === player.id || !street.plots.some((p) => p.ownerId === player.id)) return street;
    return {
      ...street,
      plots: street.plots.map((p) => {
        if (p.ownerId !== player.id) return p;
        refund += Math.round(ECONOMY.plotSizes[p.size].price * ECONOMY.legacyNeighborRefundFactor);
        released++;
        return free(p);
      }),
    };
  });
  return { player: { ...player, coins: player.coins + refund, economy: 3 }, streets: updated, refund, released };
}
