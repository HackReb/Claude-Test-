import { describe, expect, it } from "vitest";
import { LocalRepository, memoryStorage } from "../repository/LocalRepository";
import { createGameStore } from "./gameStore";

const MIN = 60_000;

function setup() {
  const repo = new LocalRepository(memoryStorage());
  let now = 0;
  const store = createGameStore(repo, () => now);
  return { repo, store, advance: (ms: number) => (now += ms) };
}

describe("gameStore", () => {
  it("Offline-Miete wird beim Start verbucht und gemeldet", async () => {
    const { repo, store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", streetName: "Weg", city: "Ulm" });

    advance(60 * MIN);
    // App neu starten: neuer Store auf demselben Speicher
    const restarted = createGameStore(repo, () => 60 * MIN);
    await restarted.getState().init();
    const { player, offlineEarnings } = restarted.getState();
    expect(offlineEarnings).toBeCloseTo(630);
    expect(player?.pendingRent).toBeCloseTo(630);

    expect(await restarted.getState().collect()).toBe(630);
    expect(restarted.getState().player?.coins).toBe(1630);
    expect(restarted.getState().offlineEarnings).toBeNull();
    expect((await repo.loadPlayer())?.coins).toBe(1630);
  });

  it("Kauf wird gespeichert", async () => {
    const { repo, store } = setup();
    await store.getState().claim({ playerName: "Kalle", streetName: "Weg", city: "Ulm" });
    const target = store.getState().street!.plots.find((p) => p.size === "S" && p.purchasedAt === undefined)!;

    const result = await store.getState().buyPlot(target.id);
    expect(result.ok).toBe(true);
    const saved = await repo.loadStreet(store.getState().street!.id);
    expect(saved?.plots.find((p) => p.id === target.id)?.purchasedAt).toBeDefined();
    expect((await repo.loadPlayer())?.coins).toBe(500);
  });

  it("tick lässt Miete während des Spielens hochlaufen", async () => {
    const { store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", streetName: "Weg", city: "Ulm" });
    advance(2 * MIN);
    await store.getState().tick();
    expect(store.getState().player?.pendingRent).toBeCloseTo(21);
  });
});
