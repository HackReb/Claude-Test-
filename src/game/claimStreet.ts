import { ECONOMY } from "../config/economy";
import type { Player, Plot, PlotSize, Street } from "../model/types";
import { createId } from "./ids";
import { hashString, seededRandom, shuffle } from "./random";
import { starterKiosk } from "./templates";

/** Grundstücksmix pro Straßenseite (6 Plätze). */
const SIDE_MIX: readonly PlotSize[] = ["S", "S", "S", "M", "M", "L"];

export interface ClaimInput {
  playerName: string;
  streetName: string;
  city: string;
}

export const NAME_MAX_LENGTH = 40;

/** Liefert eine Fehlermeldung je Feld oder ein leeres Objekt, wenn alles passt. */
export function validateClaim(input: ClaimInput): Partial<Record<keyof ClaimInput, string>> {
  const errors: Partial<Record<keyof ClaimInput, string>> = {};
  const fields: [keyof ClaimInput, string][] = [
    ["playerName", "Wie heißt du?"],
    ["streetName", "Welche Straße willst du claimen?"],
    ["city", "In welchem Ort liegt die Straße?"],
  ];
  for (const [field, emptyMessage] of fields) {
    const value = input[field].trim();
    if (value.length === 0) errors[field] = emptyMessage;
    else if (value.length > NAME_MAX_LENGTH) errors[field] = `Maximal ${NAME_MAX_LENGTH} Zeichen.`;
  }
  return errors;
}

/**
 * Legt die 12 Grundstücke einer Straße an. Das Layout hängt nur von Straße + Ort ab,
 * damit dieselbe echte Straße immer gleich aussieht (wichtig für später, wenn mehrere
 * Spieler dieselbe Straße sehen).
 */
export function generatePlots(streetName: string, city: string): Plot[] {
  const seed = hashString(`${streetName.trim().toLowerCase()}|${city.trim().toLowerCase()}`);
  const random = seededRandom(seed);
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
  const streetName = input.streetName.trim();
  const city = input.city.trim();

  const plots = generatePlots(streetName, city);
  const gift = plots.find((p) => p.size === ECONOMY.giftPlotSize);
  if (gift) Object.assign(gift, { purchasedAt: now, gifted: true, building: starterKiosk() });

  const street: Street = { id: streetId, name: streetName, city, ownerId: playerId, plots };
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
