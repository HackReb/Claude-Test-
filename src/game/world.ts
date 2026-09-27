import { inStreet } from "./names";
import type { NeighborEvent, OsmStreetRef, Plot, Street, StreetDigest } from "../model/types";

/** Bis zu dieser Entfernung (Luftlinie) gelten Straßen echter Mitspieler als Nachbarn auf der Karte. */
export const NEARBY_KM = 3;

/** Entfernung zweier Punkte in km (Haversine). */
export function distanceKm(a: Pick<OsmStreetRef, "lat" | "lon">, b: Pick<OsmStreetRef, "lat" | "lon">): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Straßen echter Mitspieler in der Nähe, die nächste zuerst. Ohne Koordinaten (ungeprüfte Straßen)
 * zählt der gleiche Ort – die kommen nach denen mit bekannter Entfernung.
 */
export function nearbyStreets(own: Street, candidates: Street[], maxKm = NEARBY_KM): Street[] {
  const withDistance = candidates
    .filter((s) => s.id !== own.id)
    .map((s) => ({ s, km: own.osm && s.osm ? distanceKm(own.osm, s.osm) : null }))
    .filter(({ s, km }) => (km === null ? s.city.trim().toLowerCase() === own.city.trim().toLowerCase() : km <= maxKm));
  return withDistance.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).map(({ s }) => s);
}

// ---------- Neuigkeiten aus Änderungen anderer Spieler ----------

const ownerOf = (street: Street, plot: Plot) => (plot.purchasedAt === undefined ? undefined : (plot.ownerId ?? street.ownerId));

/** Was man von einer Straße festhält, um später Änderungen zu erkennen. */
export function digestOf(street: Street): StreetDigest {
  const plots: StreetDigest["plots"] = {};
  for (const plot of street.plots) {
    const owner = ownerOf(street, plot);
    if (!owner) continue;
    plots[plot.id] = {
      owner,
      ...(plot.building && { name: plot.building.name, level: plot.building.level }),
      ...(plot.amenity && { amenity: plot.amenity }),
    };
  }
  return { plots };
}

export interface NewsContext {
  /** Ich – eigene Änderungen sind keine Neuigkeit. */
  me: string;
  /** Spieler-ID → Name (Besitzer der Straße und Käufer von Grundstücken). */
  names: Record<string, string>;
  at: number;
}

/**
 * Neuigkeiten: was andere Spieler seit `before` in dieser Straße getan haben (gekauft, gebaut, ausgebaut,
 * Spielplatz). Ohne früheren Stand gibt es nichts zu melden – dann wird nur festgehalten.
 */
export function streetNews(before: StreetDigest | undefined, street: Street, { me, names, at }: NewsContext): NeighborEvent[] {
  if (!before) return [];
  const mine = street.ownerId === me;
  const where = mine ? "in deiner Straße" : inStreet(street.name);
  const events: NeighborEvent[] = [];
  for (const plot of street.plots) {
    const owner = ownerOf(street, plot);
    if (!owner || owner === me) continue;
    const who = names[owner] ?? "Ein Mitspieler";
    const old = before.plots[plot.id];
    const say = (text: string) => events.push({ playerName: who, streetId: street.id, at, text });

    if (!old || old.owner !== owner) {
      say(plot.building ? `${who} hat ${where} ein Grundstück gekauft und „${plot.building.name}“ gebaut.` : `${who} hat ${where} ein ${plot.size}-Grundstück gekauft.`);
      continue;
    }
    if (plot.building && plot.building.name !== old.name) say(`${who} hat ${where} „${plot.building.name}“ gebaut.`);
    else if (plot.building && old.level !== undefined && plot.building.level > old.level)
      say(`${who} hat „${plot.building.name}“ auf Stufe ${plot.building.level} ausgebaut.`);
    if (plot.amenity === "playground" && old.amenity !== "playground") say(`${who} hat ${where} einen Spielplatz angelegt.`);
  }
  return events;
}
