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

// ---------- Präpositionen für Straßennamen ----------

/** „die Bahnhofstraße“, „der Kuddelmuddelweg“ – oder keins bei „Am Markt“ & Co. */
function genusOfStreet(name: string): "f" | "m" | "n" | null {
  const n = name.trim().toLowerCase();
  if (/^(am|an|im|in|auf|zum|zur|hinter|unter|bei|vor|über)\s/.test(n)) return null;
  if (/(straße|strasse|gasse|allee|chaussee|zeile|promenade|siedlung|steige|brücke)$/.test(n)) return "f";
  if (/(ufer|feld|tal|dorf|viertel|eck)$/.test(n)) return "n";
  if (/(weg|ring|damm|platz|pfad|steig|graben|markt|hof|berg|wall|kamp|anger|stieg|gang|kai|park|garten|winkel)$/.test(n)) return "m";
  return "f";
}

/** „in der Bahnhofstraße“, „im Kuddelmuddelweg“, „Am Markt“ */
export function inStreet(name: string): string {
  const genus = genusOfStreet(name);
  return genus === null ? name : genus === "f" ? `in der ${name}` : `im ${name}`;
}

/** „in die Bahnhofstraße“, „in den Kuddelmuddelweg“, „ins Mühlental“ */
export function intoStreet(name: string): string {
  const genus = genusOfStreet(name);
  return genus === null ? `nach „${name}“` : genus === "f" ? `in die ${name}` : genus === "m" ? `in den ${name}` : `ins ${name}`;
}

/** „aus der Bahnhofstraße“, „aus dem Kuddelmuddelweg“ */
export function fromStreet(name: string): string {
  const genus = genusOfStreet(name);
  return genus === null ? `aus „${name}“` : genus === "f" ? `aus der ${name}` : `aus dem ${name}`;
}
