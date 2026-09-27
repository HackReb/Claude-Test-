import { describe, expect, it } from "vitest";
import type { Player, Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { migrateSave } from "./migrate";

describe("migrateSave", () => {
  it("rüstet M1-Stände nach: Miet-Zähler, Geschenk-Markierung, Kiosk", () => {
    const { player, street } = claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);
    // M1-Form nachbauen
    const { pendingRent: _, ...oldPlayer } = player;
    const oldStreet: Street = {
      ...street,
      plots: street.plots.map(({ gifted: _g, building: _b, ...p }) => p),
    };

    const migrated = migrateSave(oldPlayer as Player, oldStreet, 0);
    expect(migrated.player.pendingRent).toBe(0);
    const gift = migrated.street.plots.find((p) => p.purchasedAt !== undefined)!;
    expect(gift.gifted).toBe(true);
    expect(gift.building?.name).toBe("Kalles Kiosk");
  });

  it("lässt aktuelle Stände unverändert", () => {
    const save = claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);
    const migrated = migrateSave(save.player, save.street, 0);
    expect(migrated.player).toBe(save.player);
    expect(migrated.street).toBe(save.street);
  });

  it("Stände vor Bewohnern & Kosten: Guthaben einmalig auf höchstens 2.000 gekürzt", () => {
    const { player, street } = claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);
    const { economy: _e, ...old } = player;
    const rich = migrateSave({ ...old, coins: 250_000, pendingRent: 9_000.5, lastSeen: 5 }, street, 1_000);
    expect(rich.player).toMatchObject({ coins: 2000, pendingRent: 0, lastSeen: 1_000, economy: 2 });
    const poor = migrateSave({ ...old, coins: 300, pendingRent: 99.9 }, street, 1_000);
    expect(poor.player.coins).toBe(399);
    // nur einmal
    expect(migrateSave({ ...rich.player, coins: 5_000 }, street, 2_000).player.coins).toBe(5_000);
  });
});
