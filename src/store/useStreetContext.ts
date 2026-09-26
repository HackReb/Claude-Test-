import { useMemo } from "react";
import { personaOf } from "../config/bots";
import type { Bot, Street } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "./gameStore";

/** Die Straße, in der ein Screen gerade arbeitet: die eigene oder die eines Nachbarn. */
export interface StreetContext {
  street: Street;
  /** Für Store-Aktionen; `undefined` = eigene Straße. */
  streetId?: string;
  own: boolean;
  /** Bot, dem die Straße gehört (nur bei Nachbarstraßen). */
  bot?: Bot;
  /** Vorname des Besitzers, z. B. „Kalle“ oder „Zoe“. */
  ownerName: string;
  plotRoute: (plotId: string) => string;
  builderRoute: (plotId: string) => string;
  backRoute: string;
  backLabel: string;
}

export function useStreetContext(streetId?: string): StreetContext | null {
  const own = useGameStore((s) => s.street);
  const neighbor = useGameStore((s) => (streetId ? s.neighborStreets[streetId] : undefined));
  const bot = useGameStore((s) => (streetId ? s.neighborhood?.bots.find((b) => b.streetId === streetId) : undefined));
  const playerName = useGameStore((s) => s.player?.name ?? "");

  return useMemo(() => {
    if (!own) return null;
    if (!streetId || streetId === own.id) {
      return {
        street: own,
        own: true,
        ownerName: playerName,
        plotRoute: routes.plot,
        builderRoute: routes.builder,
        backRoute: routes.street,
        backLabel: "← Zur Straße",
      };
    }
    if (!neighbor) return null;
    return {
      street: neighbor,
      streetId,
      own: false,
      bot,
      ownerName: (bot && personaOf(bot.character)?.shortName) ?? bot?.name ?? "",
      plotRoute: (plotId: string) => routes.neighborPlot(streetId, plotId),
      builderRoute: (plotId: string) => routes.neighborBuilder(streetId, plotId),
      backRoute: routes.neighborStreet(streetId),
      backLabel: `← Zur ${neighbor.name}`,
    };
  }, [own, neighbor, bot, streetId, playerName]);
}

/** Eigene Straße + Nachbarstraßen – für Preise und Gesamtmiete. */
export function useAllStreets(): Street[] {
  const own = useGameStore((s) => s.street);
  const neighbors = useGameStore((s) => s.neighborStreets);
  return useMemo(() => (own ? [own, ...Object.values(neighbors)] : []), [own, neighbors]);
}
