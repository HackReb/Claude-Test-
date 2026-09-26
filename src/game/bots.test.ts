import { describe, expect, it } from "vitest";
import { BOTS } from "../config/bots";
import type { StreetLocation } from "../model/types";
import { validateFacade } from "../parts/rules";
import { bearing, createNeighborhood, MIN_BEARING_GAP, simulateNeighborhood, spreadBearings } from "./bots";
import { claimStreet } from "./claimStreet";

const HOUR = 3_600_000;
const osm = (name: string, lat: number, lon: number) => ({
  key: `osm|de|78532|tuttlingen|${name.toLowerCase()}`,
  wayId: "W1",
  lat,
  lon,
});
const player = claimStreet(
  { playerName: "Kalle", street: { name: "Bahnhofstraße", city: "Tuttlingen", osm: osm("Bahnhofstraße", 47.98, 8.82) } },
  0,
).street;

describe("Nachbarschaft anlegen", () => {
  it("5 Bots mit Charakter, je eine eigene Straße, schon etwas bebaut", () => {
    const { neighborhood, streets } = createNeighborhood(player, [], 0);
    expect(neighborhood.bots.map((b) => b.character)).toEqual(BOTS.personas.map((p) => p.character));
    expect(streets.map((s) => s.name)).toEqual(BOTS.personas.map((p) => p.fallbackStreet));
    for (const street of streets) {
      expect(street.city).toBe("Tuttlingen");
      expect(street.plots.filter((p) => p.building)).toHaveLength(BOTS.startBuildings);
      expect(neighborhood.bots.find((b) => b.streetId === street.id)?.id).toBe(street.ownerId);
    }
  });

  it("Fantasiestraßen liegen gleichmäßig im Kreis", () => {
    const { neighborhood, streets } = createNeighborhood(player, [], 0);
    expect(streets.map((s) => neighborhood.bearings[s.id])).toEqual([90, 162, 234, 306, 18]);
  });

  it("nimmt echte Nachbarstraßen und ihre Himmelsrichtung", () => {
    const north: StreetLocation = { name: "Nordweg", city: "Tuttlingen", osm: osm("Nordweg", 47.99, 8.82) };
    const east: StreetLocation = { name: "Ostweg", city: "Tuttlingen", osm: osm("Ostweg", 47.98, 8.84) };
    const { neighborhood, streets } = createNeighborhood(player, [north, east], 0);
    expect(streets[0].name).toBe("Nordweg");
    expect(streets[0].osm).toEqual(north.osm);
    expect(streets[2].name).toBe(BOTS.personas[2].fallbackStreet); // Rest: Fantasienamen
    expect(neighborhood.bearings[streets[0].id]).toBeCloseTo(90, -1);
    expect(neighborhood.bearings[streets[1].id]).toBeCloseTo(0, -1);
  });
});

describe("Himmelsrichtungen", () => {
  it("bearing: Norden 90°, Osten 0°", () => {
    expect(bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(90);
    expect(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(0);
  });
  it("spreadBearings zieht zu dicht liegende Straßen auseinander", () => {
    const spread = spreadBearings([10, 12, 14, 200, 300]);
    const sorted = [...spread].sort((a, b) => a - b);
    const gaps = sorted.map((a, i) => (sorted[(i + 1) % sorted.length] - a + 360) % 360);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_BEARING_GAP - 1);
  });
});

describe("Simulation", () => {
  it("holt Aktionen nach, erzeugt Neuigkeiten und nur gültige Gebäude", () => {
    const start = createNeighborhood(player, [], 0);
    const { neighborhood, streets, events } = simulateNeighborhood(start.neighborhood, start.streets, 24 * HOUR);
    // chaos alle 2 h → 12 fällig, gedeckelt auf 8; concrete alle 6 h → 4
    const byBot = (character: string) => events.filter((e) => neighborhood.bots.find((b) => b.id === e.botId)?.character === character);
    expect(byBot("chaos")).toHaveLength(BOTS.maxCatchUpActions);
    expect(byBot("concrete")).toHaveLength(4);
    expect(neighborhood.news.length).toBeLessThanOrEqual(BOTS.newsLimit);
    expect(neighborhood.news[0].at).toBeGreaterThanOrEqual(neighborhood.news[1].at);
    for (const street of streets)
      for (const plot of street.plots)
        if (plot.building) expect(validateFacade(plot.building.facade, plot.size)).toEqual([]);
    // Zeitpunkt der letzten Aktion rückt um alle fälligen Intervalle vor, auch die gedeckelten
    expect(neighborhood.bots.find((b) => b.character === "chaos")!.lastActionAt).toBe(24 * HOUR);
  });

  it("ist reproduzierbar und tut nichts, wenn keine Zeit vergangen ist", () => {
    const start = createNeighborhood(player, [], 0);
    const a = simulateNeighborhood(start.neighborhood, start.streets, 10 * HOUR);
    const b = simulateNeighborhood(start.neighborhood, start.streets, 10 * HOUR);
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
    expect(simulateNeighborhood(start.neighborhood, start.streets, HOUR).events).toEqual([]);
  });

  it("volle Straßen werden ausgebaut und umgebaut statt gekauft", () => {
    const start = createNeighborhood(player, [], 0);
    let { neighborhood, streets } = start;
    for (let day = 1; day <= 30; day++) ({ neighborhood, streets } = simulateNeighborhood(neighborhood, streets, day * 24 * HOUR));
    const chaos = streets.find((s) => s.ownerId === neighborhood.bots.find((b) => b.character === "chaos")!.id)!;
    expect(chaos.plots.every((p) => p.building)).toBe(true);
    expect(chaos.plots.some((p) => p.building!.level > 1)).toBe(true);
  });
});
