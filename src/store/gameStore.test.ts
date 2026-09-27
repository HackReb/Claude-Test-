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
    expect(offlineReport!.upkeep).toBeCloseTo(10 * 12); // Kiosk: 12 pro Stunde
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
    expect(store.getState().player!.coins).toBeCloseTo(1000 - 12);
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

describe("gameStore – nur in der eigenen Straße kaufen", () => {
  it("in Nachbarstraßen kann man nicht kaufen; alte Käufe dort werden beim Start erstattet", async () => {
    const repo = new LocalRepository(memoryStorage());
    let now = 0;
    const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await vi.waitFor(() => expect(store.getState().neighborhood).not.toBeNull());

    const hood = store.getState().neighborhood!;
    const zoeStreetId = hood.bots.find((b) => b.character === "sweet")!.streetId;
    const zoeStreet = store.getState().neighborStreets[zoeStreetId];
    const plot = zoeStreet.plots.find((p) => p.size === "S" && p.purchasedAt === undefined)!;
    expect(await store.getState().buyPlot(plot.id, zoeStreetId)).toEqual({ ok: false, reason: "not-allowed" });
    expect(store.getState().player!.coins).toBe(1000);

    // Alter Spielstand (Regeln v2): Kalle hatte bei Zoe ein Grundstück mit Kiosk
    const player = store.getState().player!;
    const kiosk = buildingFromTemplate(templatesFor("S").find((t) => t.id === "kiosk")!);
    await repo.saveStreet({
      ...zoeStreet,
      plots: zoeStreet.plots.map((p) => (p.id === plot.id ? { ...p, purchasedAt: 1, ownerId: player.id, building: kiosk } : p)),
    });
    await repo.savePlayer({ ...player, economy: 2 });

    const later = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await later.getState().init();
    const freed = later.getState().neighborStreets[zoeStreetId].plots.find((p) => p.id === plot.id)!;
    expect(freed.purchasedAt).toBeUndefined();
    expect(freed.ownerId).toBeUndefined();
    expect(freed.building).toBeUndefined();
    expect(later.getState().player!.coins).toBe(1000 + 625); // 500 × 1,25 zurück
    expect(later.getState().player!.economy).toBe(3);
    expect(later.getState().offlineReport!.refund).toBe(625);
    expect((await repo.loadStreet(zoeStreetId))!.plots.find((p) => p.id === plot.id)!.ownerId).toBeUndefined();
  });
});

describe("gameStore – Bad Boys", () => {
  it("in eine Bot-Straße schicken: kostet, wirkt sofort, steht in den Neuigkeiten – und der Bot rächt sich", async () => {
    const repo = new LocalRepository(memoryStorage());
    let now = 0;
    const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await vi.waitFor(() => expect(store.getState().neighborhood).not.toBeNull());
    const chaos = store.getState().neighborhood!.bots.find((b) => b.character === "chaos")!;

    const sent = await store.getState().sendBadBoy(chaos.streetId, "muelltonnen-marvin");
    expect(sent).toMatchObject({ ok: true, blocked: false });
    expect(store.getState().player!.coins).toBe(1000 - 640);
    expect(store.getState().neighborStreets[chaos.streetId].litter).toHaveLength(6);
    expect(store.getState().neighborhood!.news[0].text).toContain("Mülltonnen-Marvin");
    expect((await repo.loadStreet(chaos.streetId))!.litter).toHaveLength(6);

    // Zu wenig Geld / eigene Straße geht nicht
    expect((await store.getState().sendBadBoy(store.getState().street!.id, "gassi-gabi")).ok).toBe(false);

    // Chaos-Chris schickt bald jemanden zurück: 7 Stunden später war schon Besuch da.
    await repo.saveNeighborhood(store.getState().neighborhood!);
    now = 7 * 60 * MIN;
    const later = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await later.getState().init();
    const street = later.getState().street!;
    expect(street.incidents?.length).toBe(1);
    expect(later.getState().neighborhood!.news.some((n) => n.text === street.incidents![0].text)).toBe(true);
  });

  it("Graffiti wegschrubben, Reparieren und Wachschutz kosten Münzen und werden gespeichert", async () => {
    const repo = new LocalRepository(memoryStorage());
    const store = createGameStore(repo, () => 0, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const kiosk = store.getState().street!.plots.find((p) => p.building)!;
    store.setState({ player: { ...store.getState().player!, coins: 10_000 } });
    store.setState({
      street: {
        ...store.getState().street!,
        plots: store.getState().street!.plots.map((p) => (p.id === kiosk.id ? { ...p, building: { ...p.building!, graffiti: "LOL", damaged: true } } : p)),
      },
    });
    expect((await store.getState().scrubGraffiti(kiosk.id)).ok).toBe(true);
    expect((await store.getState().repair(kiosk.id)).ok).toBe(true);
    expect((await store.getState().buySecurity()).ok).toBe(true);
    const saved = (await repo.loadStreet(store.getState().street!.id))!;
    expect(saved.plots.find((p) => p.id === kiosk.id)!.building).not.toHaveProperty("graffiti");
    expect(saved.security).toBe(1);
    expect(store.getState().player!.coins).toBe(10_000 - 100 - 240 - 1600);
  });
});

describe("gameStore – Tiere & Autos", () => {
  it("der Elefant geht nach seinem Takt beim Bot-Nachbarn spazieren – mit Neuigkeit und Futterkosten", async () => {
    const repo = new LocalRepository(memoryStorage());
    let now = 0;
    const store = createGameStore(repo, () => now, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await vi.waitFor(() => expect(store.getState().neighborhood).not.toBeNull());
    store.setState({ player: { ...store.getState().player!, coins: 20_000 } });

    const bought = await store.getState().buyPet("elefant", "Benjamin");
    expect(bought.ok).toBe(true);
    expect(store.getState().player!.coins).toBe(20_000 - 12_000);

    const litterBefore = Object.values(store.getState().neighborStreets).reduce((sum, s) => sum + (s.litter?.length ?? 0), 0);
    now = 16 * 60 * MIN;
    await store.getState().tick();
    const litterAfter = Object.values(store.getState().neighborStreets).reduce((sum, s) => sum + (s.litter?.length ?? 0), 0);
    expect(litterAfter - litterBefore).toBe(8);
    expect(store.getState().neighborhood!.news[0].text).toMatch(/^Kalles Elefant Benjamin war .* spazieren: 8 Haufen\. Igitt!$/);
    // Futter: 32 pro Stunde (plus Kiosk 12)
    expect(store.getState().player!.coins).toBeCloseTo(8000 - 16 * (32 + 12));
    expect((await repo.loadPlayer())!.pets![0].nextOutingAt).toBe(32 * 60 * MIN);
  });
});
