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

describe("gameStore – Leben auf der Straße", () => {
  it("Müll entsteht offline, Wegräumen bringt Münzen und wird gespeichert", async () => {
    const repo = new LocalRepository(memoryStorage());
    let now = 0;
    const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    now = 24 * 60 * MIN; // volle Nachwürfel-Zeit: Kiosk-Kundschaft hat dann praktisch sicher Müll hinterlassen
    const later = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await later.getState().init();
    const litter = later.getState().street!.litter!;
    expect(litter.length).toBeGreaterThan(0); // Kiosk → Kundschaft wirft Müll
    const coins = later.getState().player!.coins;
    const trash = litter.find((l) => l.kind === "trash")!;
    const result = await later.getState().cleanLitter(trash.id);
    expect(result?.cleaned).toBe(true);
    expect(later.getState().player!.coins).toBe(coins + result!.reward);
    expect((await repo.loadStreet(later.getState().street!.id))?.litter).toHaveLength(litter.length - 1);
  });
});

describe("gameStore – bei Nachbarn bauen", () => {
  it("kaufen, bauen, Begrüßung, und die Miete von dort kommt auch offline an", async () => {
    const repo = new LocalRepository(memoryStorage());
    let now = 0;
    const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await vi.waitFor(() => expect(store.getState().neighborhood).not.toBeNull());

    const hood = store.getState().neighborhood!;
    const zoeStreetId = hood.bots.find((b) => b.character === "sweet")!.streetId;
    const zoeStreet = store.getState().neighborStreets[zoeStreetId];
    const plot = zoeStreet.plots.find((p) => p.size === "S" && p.purchasedAt === undefined)!;

    const bought = await store.getState().buyPlot(plot.id, zoeStreetId);
    expect(bought.ok).toBe(true);
    expect(bought.greeting).toContain("Zucker-Zoe");
    expect(store.getState().player!.coins).toBe(1000 - 625);
    expect(store.getState().neighborhood!.news[0].text).toContain("Willkommen");

    const home = buildingFromTemplate(templatesFor("S").find((t) => t.id === "kiosk")!);
    expect(await store.getState().build(plot.id, home, zoeStreetId)).toBe(true);
    // Bauen auf Zoes eigenem Grundstück ist verboten
    const zoesOwn = store.getState().neighborStreets[zoeStreetId].plots.find((p) => p.building && !p.ownerId)!;
    expect(await store.getState().build(zoesOwn.id, home, zoeStreetId)).toBe(false);
    expect((await store.getState().upgrade(zoesOwn.id, zoeStreetId)).ok).toBe(false);

    // 1 h später neu starten: Miete aus beiden Straßen
    now = 60 * MIN;
    const later = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await later.getState().init();
    const saved = later.getState().neighborStreets[zoeStreetId].plots.find((p) => p.id === plot.id)!;
    expect(saved.ownerId).toBe(later.getState().player!.id);
    expect(saved.building).toBeDefined();
    const ownOnly = 60 * 10.5; // Kalles Kiosk zu Hause
    expect(later.getState().offlineEarnings!).toBeGreaterThan(ownOnly + 60 * 10);
  });
});
