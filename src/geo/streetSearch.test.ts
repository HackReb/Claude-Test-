import { describe, expect, it } from "vitest";
import { formatPlace, parsePhotonStreets, photonUrl, searchStreets, StreetSearchUnavailable } from "./streetSearch";

/** Gekürzte, echte Photon-Antwortstruktur. */
const feature = (props: Record<string, unknown>, coords: [number, number] = [8.82, 47.98]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: coords },
  properties: { osm_type: "W", osm_key: "highway", osm_value: "residential", type: "street", countrycode: "DE", ...props },
});

const response = {
  type: "FeatureCollection",
  features: [
    feature({ osm_id: 1, name: "Bahnhofstraße", postcode: "78532", city: "Tuttlingen" }),
    // derselbe Straßenzug als zweiter OSM-Weg → wird zusammengefasst
    feature({ osm_id: 2, name: "Bahnhofstraße", postcode: "78532", city: "Tuttlingen" }, [8.83, 47.99]),
    // Haltestelle mit gleichem Namen → keine Straße
    feature({ osm_id: 3, osm_type: "N", osm_value: "bus_stop", type: "house", name: "Bahnhofstraße", city: "Tuttlingen" }),
    // Dorf ohne "city" → Ortsname aus "locality"/"district"
    feature({ osm_id: 4, name: "Bahnhofstraße", postcode: "78573", locality: "Wurmlingen" }),
    // gleicher Name, anderer Ort
    feature({ osm_id: 5, name: "Bahnhofstraße", postcode: "78224", city: "Singen", district: "Nordstadt" }),
  ],
};

describe("parsePhotonStreets", () => {
  it("liefert eindeutige echte Straßen mit stabiler Kennung", () => {
    const streets = parsePhotonStreets(response);
    expect(streets.map((s) => `${s.name}, ${formatPlace(s)}`)).toEqual([
      "Bahnhofstraße, 78532 Tuttlingen",
      "Bahnhofstraße, 78573 Wurmlingen",
      "Bahnhofstraße, 78224 Singen (Nordstadt)",
    ]);
    expect(streets[0].osm).toEqual({
      key: "osm|de|78532|tuttlingen|bahnhofstraße",
      wayId: "W1",
      lat: 47.98,
      lon: 8.82,
      postcode: "78532",
      countryCode: "DE",
    });
  });

  it("verkraftet leere oder kaputte Antworten", () => {
    expect(parsePhotonStreets(null)).toEqual([]);
    expect(parsePhotonStreets({})).toEqual([]);
    expect(parsePhotonStreets({ features: [{}] })).toEqual([]);
  });
});

describe("searchStreets", () => {
  it("fragt Photon nach Straßen und parst die Antwort", async () => {
    let calledUrl = "";
    const fetchFn = (async (url: string) => {
      calledUrl = url;
      return new Response(JSON.stringify(response), { status: 200 });
    }) as unknown as typeof fetch;
    const streets = await searchStreets("Bahnhofstraße Tuttlingen", { fetchFn });
    expect(streets).toHaveLength(3);
    expect(calledUrl).toBe(photonUrl("Bahnhofstraße Tuttlingen"));
    expect(new URL(calledUrl).searchParams.get("osm_tag")).toBe("highway");
  });

  it("meldet einen nicht erreichbaren Dienst als StreetSearchUnavailable", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(searchStreets("Weg", { fetchFn: offline })).rejects.toBeInstanceOf(StreetSearchUnavailable);
    const broken = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(searchStreets("Weg", { fetchFn: broken })).rejects.toBeInstanceOf(StreetSearchUnavailable);
  });

  it("reicht einen Abbruch (neue Eingabe) als solchen durch", async () => {
    const controller = new AbortController();
    const hanging = ((_: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
    const pending = searchStreets("Weg", { signal: controller.signal, fetchFn: hanging });
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(StreetSearchUnavailable);
  });
});
