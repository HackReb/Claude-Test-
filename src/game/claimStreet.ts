import { ECONOMY } from "../config/economy";
import type { Player, Plot, PlotSize, Street, StreetLocation } from "../model/types";
import { createId } from "./ids";
import { hashString, seededRandom, shuffle } from "./random";
import { starterKiosk } from "./templates";

/** Grundstücksmix pro Straßenseite (6 Plätze). */
const SIDE_MIX: readonly PlotSize[] = ["S", "S", "S", "M", "M", "L"];

export interface ClaimInput {
  playerName: string;
  /** Aus der Kartensuche gewählt (mit `osm`) oder manuell eingetippt (ungeprüft). */
  street: StreetLocation;
}

export const NAME_MAX_LENGTH = 40;

export type ClaimErrors = Partial<Record<"playerName" | "streetName" | "city", string>>;

/** Liefert eine Fehlermeldung je Feld oder ein leeres Objekt, wenn alles passt. */
export function validateClaim(input: ClaimInput): ClaimErrors {
  const errors: ClaimErrors = {};
  const fields: [keyof ClaimErrors, string, string][] = [
    ["playerName", input.playerName, "Wie heißt du?"],
    ["streetName", input.street.name, "Welche Straße willst du claimen?"],
    ["city", input.street.city, "In welchem Ort liegt die Straße?"],
  ];
  for (const [field, raw, emptyMessage] of fields) {
    const value = raw.trim();
    if (value.length === 0) errors[field] = emptyMessage;
    else if (value.length > NAME_MAX_LENGTH) errors[field] = `Maximal ${NAME_MAX_LENGTH} Zeichen.`;
  }
  return errors;
}

/**
 * Kennung für das Grundstücks-Layout: bei echten Straßen die OSM-Kennung, sonst Name + Ort.
 * So sieht dieselbe echte Straße für alle Spieler gleich aus.
 */
export function layoutKey(location: StreetLocation): string {
  return location.osm?.key ?? `${location.name.trim().toLowerCase()}|${location.city.trim().toLowerCase()}`;
}

/** Legt die 12 Grundstücke einer Straße an – deterministisch aus der Layout-Kennung. */
export function generatePlots(key: string): Plot[] {
  const random = seededRandom(hashString(key));
  const plots: Plot[] = [];
  for (const side of ["left", "right"] as const) {
    const sizes = shuffle(SIDE_MIX.slice(0, ECONOMY.plotsPerSide), random);
    sizes.forEach((size, index) => {
      plots.push({ id: createId(), size, side, index, price: ECONOMY.plotSizes[size].price });
    });
  }
  return plots;
}

/** Erzeugt Spieler + Straße für einen neuen Spielstand inkl. geschenktem Start-Grundstück mit Kiosk. */
export function claimStreet(input: ClaimInput, now: number): { player: Player; street: Street } {
  const playerId = createId();
  const streetId = createId();
  const streetName = input.street.name.trim();
  const city = input.street.city.trim();

  const plots = generatePlots(layoutKey({ ...input.street, name: streetName, city }));
  const gift = plots.find((p) => p.size === ECONOMY.giftPlotSize);
  if (gift) Object.assign(gift, { purchasedAt: now, gifted: true, building: starterKiosk() });

  const street: Street = {
    id: streetId,
    name: streetName,
    city,
    ...(input.street.osm && { osm: input.street.osm }),
    ownerId: playerId,
    plots,
  };
  const player: Player = {
    id: playerId,
    name: input.playerName.trim(),
    coins: ECONOMY.startCoins,
    pendingRent: 0,
    unlockedParts: [],
    streetId,
    lastSeen: now,
  };
  return { player, street };
}

/**
 * Bestätigt eine ungeprüfte Straße nachträglich über die Kartensuche. Name und Ort werden
 * auf die echte Schreibweise gesetzt; Grundstücke und Gebäude bleiben, wie sie sind.
 */
export function verifyStreet(street: Street, location: StreetLocation): Street | null {
  if (street.osm || !location.osm) return null;
  return { ...street, name: location.name, city: location.city, osm: location.osm };
}
