import { ALIENS } from "../config/aliens";
import { MISCHIEF } from "../config/badboys";
import type { Incident, Player, Plot, Street } from "../model/types";
import { createId } from "./ids";

const HOUR = 3_600_000;
export const ALIEN_ID = "aliens";

/**
 * Wann das UFO kommt, wenn die Straße um `openedAt` geöffnet wurde:
 * beim ersten Mal bald (jeder soll es einmal sehen), danach erst, wenn der nächste Besuch fällig ist.
 */
export function alienDueAt(player: Player, openedAt: number): number {
  if (!player.aliens) return openedAt + ALIENS.firstVisitAfterSeconds * 1000;
  return Math.max(player.aliens.nextAt, openedAt + ALIENS.arriveAfterSeconds * 1000);
}

/** Welche Häuser getroffen werden können: eigene Gebäude, unbeschädigte zuerst. */
export function alienTargets(street: Street, playerId: string): Plot[] {
  const own = street.plots.filter((p) => p.purchasedAt !== undefined && p.building && (p.ownerId ?? street.ownerId) === playerId);
  const intact = own.filter((p) => !p.building!.damaged);
  return intact.length > 0 ? intact : own;
}

/** Der Laser trifft: Fenster kaputt, Meldung in der Straße, nächster Besuch in ein paar Tagen. */
export function alienAttack(player: Player, street: Street, plotId: string, now: number, random: () => number = Math.random) {
  const plot = street.plots.find((p) => p.id === plotId);
  const hours = ALIENS.minHoursBetween + random() * (ALIENS.maxHoursBetween - ALIENS.minHoursBetween);
  const nextPlayer: Player = { ...player, aliens: { lastAt: now, nextAt: now + hours * HOUR } };
  if (!plot?.building) return { player: nextPlayer, street, incident: null };

  const incident: Incident = {
    id: createId(),
    at: now,
    badBoyId: ALIEN_ID,
    blocked: false,
    text: `👽 Aliens! Ein UFO hat ${plot.building.name} mit dem Laser getroffen – die Fenster sind kaputt.`,
  };
  return {
    player: nextPlayer,
    incident,
    street: {
      ...street,
      plots: street.plots.map((p) => (p.id === plotId ? { ...p, building: { ...p.building!, damaged: true } } : p)),
      incidents: [incident, ...(street.incidents ?? [])].slice(0, MISCHIEF.incidentLimit),
    },
  };
}
