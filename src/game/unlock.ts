import type { Player } from "../model/types";
import { getPart, isUnlocked } from "../parts/catalog";

export type UnlockResult = { ok: true; player: Player } | { ok: false; reason: "unknown" | "already" | "too-expensive" };

/** Schaltet einen Baustein gegen Münzen frei. */
export function unlockPart(player: Player, partId: string): UnlockResult {
  const part = getPart(partId);
  if (!part) return { ok: false, reason: "unknown" };
  if (isUnlocked(part, player.unlockedParts)) return { ok: false, reason: "already" };
  if (player.coins < part.price) return { ok: false, reason: "too-expensive" };
  return { ok: true, player: { ...player, coins: player.coins - part.price, unlockedParts: [...player.unlockedParts, partId] } };
}
