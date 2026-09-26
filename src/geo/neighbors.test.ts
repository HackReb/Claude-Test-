import { describe, expect, it } from "vitest";
import { findNeighborStreets, photonReverseUrl } from "./neighbors";

const own = { key: "osm|de|78532|tuttlingen|bahnhofstraße", wayId: "W1", lat: 47.98, lon: 8.82 };
const f = (id: number, name: string) => ({
  geometry: { coordinates: [8.82 + id / 1000, 47.98] },
  properties: { osm_id: id, osm_type: "W", type: "street", name, postcode: "78532", city: "Tuttlingen", countrycode: "DE" },
});
const respond = (features: unknown[]) =>
  (async () => new Response(JSON.stringify({ features }), { status: 200 })) as unknown as typeof fetch;

describe("findNeighborStreets", () => {
  it("liefert verschiedene Nachbarstraßen ohne die eigene", async () => {
    const fetchFn = respond([
      f(1, "Bahnhofstraße"),
      f(2, "Schillerstraße"),
      f(3, "Schillerstraße"),
      f(4, "Goethestraße"),
      f(5, "Uhlandstraße"),
      f(6, "Karlstraße"),
      f(7, "Mühlweg"),
      f(8, "Donaustraße"),
    ]);
    const streets = await findNeighborStreets(own, "Bahnhofstraße", { fetchFn });
    expect(streets.map((s) => s.name)).toEqual(["Schillerstraße", "Goethestraße", "Uhlandstraße", "Karlstraße", "Mühlweg"]);
  });

  it("gibt bei Fehlern eine leere Liste zurück", async () => {
    const offline = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await findNeighborStreets(own, "Bahnhofstraße", { fetchFn: offline })).toEqual([]);
    expect(new URL(photonReverseUrl(own)).searchParams.get("lat")).toBe("47.98");
  });
});
