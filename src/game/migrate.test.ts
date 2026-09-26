import { describe, expect, it } from "vitest";
import type { Player, Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { migrateSave } from "./migrate";

describe("migrateSave", () => {
  it("rüstet M1-Stände nach: Miet-Zähler, Geschenk-Markierung, Kiosk", () => {
    const { player, street } = claimStreet({ playerName: "Kalle", streetName: "Weg", city: "Ulm" }, 0);
    // M1-Form nachbauen
    const { pendingRent: _, ...oldPlayer } = player;
    const oldStreet: Street = {
      ...street,
      plots: street.plots.map(({ gifted: _g, building: _b, ...p }) => p),
    };

    const migrated = migrateSave(oldPlayer as Player, oldStreet);
    expect(migrated.player.pendingRent).toBe(0);
    const gift = migrated.street.plots.find((p) => p.purchasedAt !== undefined)!;
    expect(gift.gifted).toBe(true);
    expect(gift.building?.name).toBe("Kiosk");
  });

  it("lässt aktuelle Stände unverändert", () => {
    const save = claimStreet({ playerName: "Kalle", streetName: "Weg", city: "Ulm" }, 0);
    const migrated = migrateSave(save.player, save.street);
    expect(migrated.player).toBe(save.player);
    expect(migrated.street).toBe(save.street);
  });
});
