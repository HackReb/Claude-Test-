import { describe, expect, it } from "vitest";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { buyPlot, currentPrice, plotsBought } from "./plots";

const start = () => claimStreet({ playerName: "Kalle", streetName: "Weg", city: "Ulm" }, 0);
const free = (street: Street, size: "S" | "M" | "L") =>
  street.plots.find((p) => p.size === size && p.purchasedAt === undefined)!;

describe("Grundstücke kaufen", () => {
  it("das Geschenk zählt nicht als Kauf", () => {
    const { street } = start();
    expect(plotsBought(street)).toBe(0);
    expect(currentPrice(street, free(street, "S"))).toBe(500);
  });

  it("zieht Münzen ab, markiert als gekauft und hebt die Preise um 15 %", () => {
    const { player, street } = start();
    const target = free(street, "S");
    const result = buyPlot(player, street, target.id, 99);
    if (!result.ok) throw new Error(result.reason);
    expect(result.price).toBe(500);
    expect(result.player.coins).toBe(500);
    expect(result.street.plots.find((p) => p.id === target.id)?.purchasedAt).toBe(99);
    expect(currentPrice(result.street, free(result.street, "S"))).toBe(575);
    expect(currentPrice(result.street, free(result.street, "M"))).toBe(1725);
    // Original bleibt unverändert
    expect(street.plots.find((p) => p.id === target.id)?.purchasedAt).toBeUndefined();
  });

  it("verweigert zu teure und schon gekaufte Grundstücke", () => {
    const { player, street } = start();
    expect(buyPlot(player, street, free(street, "L").id, 1)).toEqual({ ok: false, reason: "too-expensive" });
    const gift = street.plots.find((p) => p.gifted)!;
    expect(buyPlot(player, street, gift.id, 1)).toEqual({ ok: false, reason: "owned" });
    expect(buyPlot(player, street, "gibt-es-nicht", 1)).toEqual({ ok: false, reason: "not-found" });
  });
});
