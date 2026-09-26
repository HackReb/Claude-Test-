import { describe, expect, it } from "vitest";
import { ECONOMY } from "../config/economy";
import { claimStreet } from "./claimStreet";
import { accrueRent, collectRent, streetRentPerMinute } from "./rent";

const MIN = 60_000;
const start = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);

describe("Miete", () => {
  it("Start-Kiosk bringt S-Basismiete + 5 % für das Schild", () => {
    const { street } = start();
    expect(streetRentPerMinute(street)).toBeCloseTo(ECONOMY.plotSizes.S.baseRentPerMinute * 1.05);
  });

  it("verbucht Miete pro Minute in pendingRent", () => {
    const { player, street } = start();
    const { player: after, gained } = accrueRent(player, street, 10 * MIN);
    expect(gained).toBeCloseTo(105);
    expect(after.pendingRent).toBeCloseTo(105);
    expect(after.lastSeen).toBe(10 * MIN);
    expect(after.coins).toBe(player.coins);
  });

  it("deckelt Offline-Zeit auf 8 h", () => {
    const { player, street } = start();
    const { gained } = accrueRent(player, street, 3 * 24 * 60 * MIN);
    expect(gained).toBeCloseTo(8 * 60 * 10.5);
  });

  it("ignoriert Uhren, die zurückspringen", () => {
    const { player, street } = start();
    const { player: after, gained } = accrueRent({ ...player, lastSeen: 5 * MIN }, street, 1 * MIN);
    expect(gained).toBe(0);
    expect(after.lastSeen).toBe(5 * MIN);
  });

  it("Einsammeln überträgt ganze Münzen, Bruchteile bleiben", () => {
    const { player } = start();
    const { player: after, collected } = collectRent({ ...player, pendingRent: 42.7 });
    expect(collected).toBe(42);
    expect(after.coins).toBe(player.coins + 42);
    expect(after.pendingRent).toBeCloseTo(0.7);
  });
});
