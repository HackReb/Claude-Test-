import { GEO } from "../config/geo";
import type { OsmStreetRef, StreetLocation } from "../model/types";
import { parsePhotonStreets } from "./streetSearch";

export function photonReverseUrl(osm: Pick<OsmStreetRef, "lat" | "lon">): string {
  const params = new URLSearchParams({
    lat: String(osm.lat),
    lon: String(osm.lon),
    radius: String(GEO.neighborRadiusKm),
    limit: "40",
    lang: GEO.language,
    osm_tag: "highway",
  });
  return `${GEO.photonReverseUrl}?${params}`;
}

/**
 * Echte Straßen in der Nähe einer Straße (ohne sie selbst). Bei Fehlern leere Liste –
 * die Nachbarschaft bekommt dann Fantasienamen.
 */
export async function findNeighborStreets(
  osm: OsmStreetRef,
  ownName: string,
  { fetchFn = fetch, max = 5 }: { fetchFn?: typeof fetch; max?: number } = {},
): Promise<StreetLocation[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO.timeoutMs);
  try {
    const response = await fetchFn(photonReverseUrl(osm), { signal: controller.signal });
    if (!response.ok) return [];
    const own = ownName.trim().toLowerCase();
    const seenNames = new Set<string>([own]);
    // Nach Namen entdoppeln: Nachbarn sollen verschiedene Straßen sein, nicht Abschnitte derselben.
    return parsePhotonStreets(await response.json(), Infinity)
      .filter((s) => s.osm?.key !== osm.key)
      .filter((s) => {
        const name = s.name.trim().toLowerCase();
        if (seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
      })
      .slice(0, max);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
