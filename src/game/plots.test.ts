import { describe, expect, it } from "vitest";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { buyPlot, currentPrice, nextUpgrade, plotsBought, renameBuilding, upgradePlot } from "./plots";

const start = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);
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

describe("Upgrades", () => {
  it("Stufe 2 kostet 50 %, Stufe 3 100 % des Grundstückpreises, danach ist Schluss", () => {
    const { player, street } = start();
    const gift = street.plots.find((p) => p.gifted)!;
    expect(nextUpgrade(gift)).toEqual({ level: 2, cost: 250 });

    const first = upgradePlot(player, street, gift.id);
    if (!first.ok) throw new Error(first.reason);
    expect(first.player.coins).toBe(750);
    const upgraded = first.street.plots.find((p) => p.id === gift.id)!;
    expect(upgraded.building?.level).toBe(2);
    expect(nextUpgrade(upgraded)).toEqual({ level: 3, cost: 500 });

    const second = upgradePlot(first.player, first.street, gift.id);
    if (!second.ok) throw new Error(second.reason);
    expect(second.player.coins).toBe(250);
    expect(upgradePlot(second.player, second.street, gift.id)).toEqual({ ok: false, reason: "max-level" });
  });

  it("verweigert leere Bauplätze und fehlendes Geld", () => {
    const { player, street } = start();
    const gift = street.plots.find((p) => p.gifted)!;
    expect(upgradePlot({ ...player, coins: 100 }, street, gift.id)).toEqual({ ok: false, reason: "too-expensive" });
    const bought = buyPlot(player, street, free(street, "S").id, 1);
    if (!bought.ok) throw new Error();
    const empty = bought.street.plots.find((p) => p.purchasedAt === 1)!;
    expect(upgradePlot(bought.player, bought.street, empty.id)).toEqual({ ok: false, reason: "no-building" });
  });
});

describe("Umbenennen", () => {
  it("setzt einen bereinigten Namen, leere Namen werden abgelehnt", () => {
    const { street } = start();
    const gift = street.plots.find((p) => p.gifted)!;
    const renamed = renameBuilding(street, gift.id, "  Kalles   Späti ")!;
    expect(renamed.plots.find((p) => p.id === gift.id)?.building?.name).toBe("Kalles Späti");
    expect(renameBuilding(street, gift.id, "   ")).toBeNull();
    expect(renameBuilding(street, free(street, "S").id, "X")).toBeNull();
  });
});
