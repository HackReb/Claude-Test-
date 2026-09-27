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
  it("Offline: Miete in die Kasse, Kosten vom Konto – beim Start gemeldet", async () => {
    const { repo, store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });

    advance(10 * 60 * MIN);
    // App neu starten: neuer Store auf demselben Speicher
    const restarted = createGameStore(repo, () => 10 * 60 * MIN);
    await restarted.getState().init();
    const { player, offlineReport } = restarted.getState();
    expect(offlineReport!.income).toBeGreaterThan(10);
    expect(offlineReport!.upkeep).toBeCloseTo(10 * 1.5); // Kiosk: 1,5 pro Stunde
    expect(player!.pendingRent).toBeCloseTo(offlineReport!.income);
    expect(player!.coins).toBeCloseTo(1000 - offlineReport!.upkeep);

    const collected = await restarted.getState().collect();
    expect(collected).toBe(Math.floor(offlineReport!.income));
    expect(restarted.getState().player!.coins).toBeCloseTo(1000 - offlineReport!.upkeep + collected);
    expect(restarted.getState().offlineReport).toBeNull();
    expect((await repo.loadPlayer())?.coins).toBeCloseTo(restarted.getState().player!.coins);
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
    expect(store.getState().player?.pendingRent).toBeGreaterThan(0); // 10 min Kiosk vorher verbucht
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

  it("tick lässt Miete während des Spielens hochlaufen und bucht Kosten ab", async () => {
    const { store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    advance(60 * MIN);
    await store.getState().tick();
    expect(store.getState().player!.pendingRent).toBeGreaterThan(1);
    expect(store.getState().player!.coins).toBeCloseTo(1000 - 1.5);
  });

  it("neue Wohnhäuser füllen sich nach und nach – gespeichert wird nur, was man sieht", async () => {
    const { repo, store, advance } = setup();
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const free = store.getState().street!.plots.find((p) => p.size === "S" && p.purchasedAt === undefined)!;
    await store.getState().buyPlot(free.id);
    const home = buildingFromTemplate(templatesFor("S").find((t) => t.id === "haeuschen")!);
    expect(await store.getState().build(free.id, home)).toBe(true);
    const occupancy = () => store.getState().street!.plots.find((p) => p.id === free.id)!.building!.occupancy!;
    expect(occupancy()).toBe(0.25);

    advance(5 * 60 * MIN);
    await store.getState().tick();
    // Wie viel Müll in 5 Std. entsteht, hängt an der (zufälligen) Straßen-ID – eingezogen wird aber immer.
    expect(occupancy()).toBeGreaterThan(0.3);
    const saved = (await repo.loadStreet(store.getState().street!.id))!.plots.find((p) => p.id === free.id)!;
    expect(saved.building!.occupancy).toBeCloseTo(occupancy());
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
    // Kosten für beide Kioske (je 1,5/Std), Miete auch aus Zoes Straße
    expect(later.getState().offlineReport!.upkeep).toBeCloseTo(3);
    expect(saved.building!.occupancy).toBeGreaterThan(0.25);
  });
});
