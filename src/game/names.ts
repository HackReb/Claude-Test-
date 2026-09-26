/** Namen spielen die Hauptrolle: Wem gehört die Straße, wie heißt jedes Haus? */

export const BUILDING_NAME_MAX_LENGTH = 32;

/**
 * Deutscher Genitiv für Besitz: "Kalle" → "Kalles", "Hans" → "Hans’", "Max" → "Max’".
 * (Namen auf s, ß, x, z, tz und ce bekommen nur einen Apostroph.)
 */
export function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return /(s|ß|x|z|ce)$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}s`;
}

/** "Kalle" + "Kiosk" → "Kalles Kiosk" (gekürzt auf die Höchstlänge, notfalls ohne Besitzer). */
export function personalName(owner: string, base: string): string {
  const full = `${possessive(owner)} ${base}`.trim();
  return full.length <= BUILDING_NAME_MAX_LENGTH ? full : base.slice(0, BUILDING_NAME_MAX_LENGTH);
}

/** "Kalle" + "Bahnhofstraße" → "Kalles Bahnhofstraße" */
export const ownedStreetName = (owner: string, street: string) => `${possessive(owner)} ${street}`;

/** Bereinigter Gebäudename oder null, wenn er leer ist. */
export function cleanBuildingName(name: string): string | null {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, BUILDING_NAME_MAX_LENGTH);
  return clean.length > 0 ? clean : null;
}
