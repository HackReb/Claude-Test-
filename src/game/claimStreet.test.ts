import { describe, expect, it } from "vitest";
import { ECONOMY } from "../config/economy";
import type { StreetLocation } from "../model/types";
import { claimStreet, generatePlots, layoutKey, validateClaim, verifyStreet } from "./claimStreet";

const manual: StreetLocation = { name: " Bahnhofstraße ", city: "Tuttlingen" };
const real: StreetLocation = {
  name: "Bahnhofstraße",
  city: "Tuttlingen",
  osm: { key: "osm|de|78532|tuttlingen|bahnhofstraße", wayId: "W123", lat: 47.98, lon: 8.82, postcode: "78532", countryCode: "DE" },
};
const input = { playerName: " Kalle ", street: manual };

describe("claimStreet", () => {
  it("legt Spieler mit Startmünzen und Straße mit 12 Grundstücken an", () => {
    const { player, street } = claimStreet(input, 123);
    expect(player.name).toBe("Kalle");
    expect(player.coins).toBe(ECONOMY.startCoins);
    expect(player.streetId).toBe(street.id);
    expect(player.lastSeen).toBe(123);
    expect(street.name).toBe("Bahnhofstraße");
    expect(street.ownerId).toBe(player.id);
    expect(street.plots).toHaveLength(12);
    expect(street.plots.filter((p) => p.side === "left")).toHaveLength(6);
  });

  it("manuell eingegebene Straße bleibt ungeprüft, echte Straße behält ihren OSM-Verweis", () => {
    expect(claimStreet(input, 1).street.osm).toBeUndefined();
    expect(claimStreet({ playerName: "Kalle", street: real }, 1).street.osm).toEqual(real.osm);
  });

  it("schenkt genau ein S-Grundstück mit Kiosk", () => {
    const { street } = claimStreet(input, 123);
    const owned = street.plots.filter((p) => p.purchasedAt !== undefined);
    expect(owned).toHaveLength(1);
    expect(owned[0].size).toBe("S");
    expect(owned[0].gifted).toBe(true);
    expect(owned[0].building?.name).toBe("Kalles Kiosk");
  });

  it("gleiche Straße ergibt gleiches Layout", () => {
    const layout = (key: string) => generatePlots(key).map((p) => `${p.side}${p.index}${p.size}`);
    // manuell: egal wie geschrieben
    expect(layout(layoutKey({ name: "Bahnhofstraße", city: "Tuttlingen" }))).toEqual(
      layout(layoutKey({ name: " bahnhofstraße", city: "TUTTLINGEN " })),
    );
    // echte Straße: Layout hängt an der OSM-Kennung
    expect(layoutKey(real)).toBe(real.osm!.key);
  });

  it("enthält S, M und L mit Preisen aus der Config", () => {
    const plots = generatePlots("hauptstraße|berlin");
    for (const size of ["S", "M", "L"] as const) {
      const ofSize = plots.filter((p) => p.size === size);
      expect(ofSize.length).toBeGreaterThan(0);
      expect(ofSize.every((p) => p.price === ECONOMY.plotSizes[size].price)).toBe(true);
    }
  });

  it("validiert leere und zu lange Eingaben", () => {
    expect(validateClaim(input)).toEqual({});
    const errors = validateClaim({ playerName: "  ", street: { name: "x".repeat(41), city: "Ulm" } });
    expect(Object.keys(errors).sort()).toEqual(["playerName", "streetName"]);
  });
});

describe("verifyStreet", () => {
  it("bestätigt eine ungeprüfte Straße und behält Grundstücke", () => {
    const { street } = claimStreet({ playerName: "Kalle", street: { name: "bahnhofstr", city: "tuttlingen" } }, 1);
    const verified = verifyStreet(street, real)!;
    expect(verified.name).toBe("Bahnhofstraße");
    expect(verified.city).toBe("Tuttlingen");
    expect(verified.osm).toEqual(real.osm);
    expect(verified.plots).toBe(street.plots);
  });

  it("lässt geprüfte Straßen in Ruhe und verlangt einen OSM-Verweis", () => {
    const { street } = claimStreet({ playerName: "Kalle", street: real }, 1);
    expect(verifyStreet(street, real)).toBeNull();
    const unverified = claimStreet(input, 1).street;
    expect(verifyStreet(unverified, manual)).toBeNull();
  });
});
