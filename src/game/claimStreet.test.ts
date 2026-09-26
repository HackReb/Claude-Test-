import { describe, expect, it } from "vitest";
import { ECONOMY } from "../config/economy";
import { claimStreet, generatePlots, validateClaim } from "./claimStreet";

const input = { playerName: " Kalle ", streetName: " Bahnhofstraße ", city: "Tuttlingen" };

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

  it("schenkt genau ein S-Grundstück", () => {
    const { street } = claimStreet(input, 123);
    const owned = street.plots.filter((p) => p.purchasedAt !== undefined);
    expect(owned).toHaveLength(1);
    expect(owned[0].size).toBe("S");
    expect(owned[0].purchasedAt).toBe(123);
  });

  it("gleiche Straße ergibt gleiches Layout, egal wie geschrieben", () => {
    const layout = (name: string, city: string) => generatePlots(name, city).map((p) => `${p.side}${p.index}${p.size}`);
    expect(layout("Bahnhofstraße", "Tuttlingen")).toEqual(layout(" bahnhofstraße", "TUTTLINGEN "));
  });

  it("enthält S, M und L mit Preisen aus der Config", () => {
    const plots = generatePlots("Hauptstraße", "Berlin");
    for (const size of ["S", "M", "L"] as const) {
      const ofSize = plots.filter((p) => p.size === size);
      expect(ofSize.length).toBeGreaterThan(0);
      expect(ofSize.every((p) => p.price === ECONOMY.plotSizes[size].price)).toBe(true);
    }
  });

  it("validiert leere und zu lange Eingaben", () => {
    expect(validateClaim(input)).toEqual({});
    const errors = validateClaim({ playerName: "  ", streetName: "x".repeat(41), city: "Ulm" });
    expect(Object.keys(errors).sort()).toEqual(["playerName", "streetName"]);
  });
});
