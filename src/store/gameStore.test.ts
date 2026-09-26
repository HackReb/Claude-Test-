import { describe, expect, it, vi } from "vitest";
import { LocalRepository, memoryStorage } from "../repository/LocalRepository";
import { buildingFromTemplate, templatesFor } from "../game/templates";
import { createGameStore } from "./gameStore";

const MIN = 60_000;

function setup() {
  const repo = new LocalRepository(memoryStorage());
  let now = 0;
  const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
  return { repo, store, advance: (ms: number) => (now += ms) };
}

describe("gameStore", () => {
  it("Offline-Miete wird beim Start verbucht und gemeldet", async () => {
    const { repo, store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });

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
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const target = store.getState().street!.plots.find((p) => p.size === "S" && p.purchasedAt === undefined)!;

    const result = await store.getState().buyPlot(target.id);
    expect(result.ok).toBe(true);
    const saved = await repo.loadStreet(store.getState().street!.id);
    expect(saved?.plots.find((p) => p.id === target.id)?.purchasedAt).toBeDefined();
    expect((await repo.loadPlayer())?.coins).toBe(500);
  });

  it("Bauen ersetzt das Gebäude, verbucht vorher die alte Miete und speichert", async () => {
    const { repo, store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const gift = store.getState().street!.plots.find((p) => p.gifted)!;
    advance(10 * MIN);

    const imbiss = buildingFromTemplate(templatesFor("S").find((t) => t.id === "imbiss")!);
    expect(await store.getState().build(gift.id, imbiss)).toBe(true);
    expect(store.getState().player?.pendingRent).toBeCloseTo(105); // 10 min Kiosk
    const saved = await repo.loadStreet(store.getState().street!.id);
    expect(saved?.plots.find((p) => p.id === gift.id)?.building?.name).toBe("Imbiss");

    const free = store.getState().street!.plots.find((p) => p.purchasedAt === undefined)!;
    expect(await store.getState().build(free.id, imbiss)).toBe(false);
  });

  it("Nachbarn ziehen nach dem Claimen ein und sind beim nächsten Start weitergekommen", async () => {
    const { repo, store } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await vi.waitFor(() => expect(store.getState().neighborhood).not.toBeNull());
    expect(Object.keys(store.getState().neighborStreets)).toHaveLength(5);

    const later = createGameStore(repo, () => 24 * 60 * MIN, { findNeighbors: async () => [] });
    await later.getState().init();
    const neighborhood = later.getState().neighborhood!;
    expect(neighborhood.news.length).toBeGreaterThan(0);
    expect(neighborhood.news.every((n) => n.at > neighborhood.newsSeenAt)).toBe(true);
    await later.getState().markNewsSeen();
    expect((await repo.loadNeighborhood())?.newsSeenAt).toBe(24 * 60 * MIN);
  });

  it("Upgrade kostet Münzen und wird gespeichert", async () => {
    const { repo, store } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const gift = store.getState().street!.plots.find((p) => p.gifted)!;
    expect((await store.getState().upgrade(gift.id)).ok).toBe(true);
    expect(store.getState().player?.coins).toBe(750);
    const saved = await repo.loadStreet(store.getState().street!.id);
    expect(saved?.plots.find((p) => p.id === gift.id)?.building?.level).toBe(2);
  });

  it("tick lässt Miete während des Spielens hochlaufen", async () => {
    const { store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    advance(2 * MIN);
    await store.getState().tick();
    expect(store.getState().player?.pendingRent).toBeCloseTo(21);
  });
});
