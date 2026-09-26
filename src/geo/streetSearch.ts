import { GEO } from "../config/geo";
import type { OsmStreetRef, StreetLocation } from "../model/types";

/** Der Kartendienst ist nicht erreichbar (offline, Dienst gestört, blockiert). */
export class StreetSearchUnavailable extends Error {
  constructor(cause?: unknown) {
    super("Straßensuche nicht erreichbar", { cause });
    this.name = "StreetSearchUnavailable";
  }
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Kennung einer echten Straße – gleiche Straße, gleiche Kennung, egal welcher OSM-Weg gefunden wurde. */
export function osmStreetKey(parts: { countryCode?: string; postcode?: string; city: string; name: string }): string {
  return ["osm", parts.countryCode ?? "", parts.postcode ?? "", parts.city, parts.name].map(normalize).join("|");
}

export function photonUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    lang: GEO.language,
    // Mehr holen als angezeigt wird: eine Straße kommt oft als mehrere OSM-Wege zurück.
    limit: String(GEO.maxResults * 3),
    osm_tag: "highway",
  });
  return `${GEO.photonUrl}?${params}`;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    type?: string;
    name?: string;
    postcode?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    countrycode?: string;
  };
}

/** Wandelt eine Photon-Antwort in eindeutige Straßen um (nur echte Straßen, keine Haltestellen o. Ä.). */
export function parsePhotonStreets(json: unknown): StreetLocation[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features ?? [];
  const seen = new Set<string>();
  const streets: StreetLocation[] = [];

  for (const { geometry, properties: p } of features) {
    if (!p || p.type !== "street" || p.osm_type !== "W" || !p.name || !p.osm_id) continue;
    // Dörfer haben in Photon oft kein "city" – dann den nächstbesten Ortsnamen nehmen.
    const city = p.city ?? p.locality ?? p.district ?? p.county;
    const [lon, lat] = geometry?.coordinates ?? [];
    if (!city || lat === undefined || lon === undefined) continue;

    const osm: OsmStreetRef = {
      key: osmStreetKey({ countryCode: p.countrycode, postcode: p.postcode, city, name: p.name }),
      wayId: `W${p.osm_id}`,
      lat,
      lon,
      ...(p.postcode && { postcode: p.postcode }),
      ...(p.district && p.district !== city && { district: p.district }),
      ...(p.countrycode && { countryCode: p.countrycode }),
    };
    if (seen.has(osm.key)) continue;
    seen.add(osm.key);
    streets.push({ name: p.name, city, osm });
    if (streets.length === GEO.maxResults) break;
  }
  return streets;
}

/**
 * Sucht echte Straßen zu einer Eingabe wie "Bahnhofstraße Tuttlingen".
 * Wirft StreetSearchUnavailable, wenn der Dienst nicht antwortet; ein Abbruch über `signal` wird durchgereicht.
 */
export async function searchStreets(
  query: string,
  { signal, fetchFn = fetch }: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<StreetLocation[]> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), GEO.timeoutMs);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetchFn(photonUrl(query), { signal: timeout.signal });
    if (!response.ok) throw new StreetSearchUnavailable(`HTTP ${response.status}`);
    return parsePhotonStreets(await response.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    throw error instanceof StreetSearchUnavailable ? error : new StreetSearchUnavailable(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Anzeige einer Straße mit PLZ, z. B. "78532 Tuttlingen". */
export function formatPlace(location: Pick<StreetLocation, "city" | "osm">): string {
  const district = location.osm?.district ? ` (${location.osm.district})` : "";
  return `${location.osm?.postcode ? `${location.osm.postcode} ` : ""}${location.city}${district}`;
}
