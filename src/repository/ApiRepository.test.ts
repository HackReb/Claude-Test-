import { describe, expect, it } from "vitest";
import { claimStreet } from "../game/claimStreet";
import type { Street } from "../model/types";
import { createGameStore } from "../store/gameStore";
import { ApiRepository, normalizeCode } from "./ApiRepository";
import { LocalRepository, memoryStorage } from "./LocalRepository";
import { StreetTakenError } from "./Repository";

interface Call {
  method: string;
  path: string;
  body: any;
  token: string | null;
}

type Reply = { status: number; body?: unknown } | "offline";

/** Simulierter Server: jede Anfrage wird protokolliert, `handle` entscheidet über die Antwort. */
function fakeServer(handle: (call: Call) => Reply | undefined = () => undefined) {
  const calls: Call[] = [];
  let offline = false;
  const fetcher = (async (url: string, init: RequestInit) => {
    const call: Call = {
      method: init.method ?? "GET",
      path: url.replace("https://api.test/api", ""),
      body: init.body ? JSON.parse(init.body as string) : undefined,
      token: (init.headers as Record<string, string>).Authorization?.replace("Bearer ", "") ?? null,
    };
    calls.push(call);
    const reply = offline ? "offline" : (handle(call) ?? defaultReply(call));
    if (reply === "offline") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  }) as typeof fetch;
  return {
    calls,
    fetcher,
    setOffline: (value: boolean) => (offline = value),
    paths: () => calls.map((c) => `${c.method} ${c.path}`),
  };
}

function defaultReply(call: Call): Reply {
  if (call.path === "/register") return { status: 201, body: { token: "tok-1", recoveryCode: "BABO-AAAA-BBBB-CCCC" } };
  if (call.method === "PUT" && call.path.startsWith("/streets/")) return { status: 200, body: { street: call.body.street, ownerName: null } };
  return { status: 200, body: { ok: true } };
}

function setup(handle?: (call: Call) => Reply | undefined) {
  const storage = memoryStorage();
  const server = fakeServer(handle);
  const make = () => new ApiRepository("https://api.test/", new LocalRepository(storage), storage, server.fetcher);
  return { storage, server, repo: make(), make };
}

const start = (name = "Kalle") => claimStreet({ playerName: name, street: { name: "Weg", city: "Ulm" } }, 0);

describe("ApiRepository", () => {
  it("meldet an und schickt danach mit Geräte-Schlüssel", async () => {
    const { repo, server } = setup();
    const { player, street } = start();
    await repo.online.register(player, street);
    expect(repo.online.account()).toEqual({ status: "online", recoveryCode: "BABO-AAAA-BBBB-CCCC" });

    await repo.saveStreet(street);
    await repo.savePlayer({ ...player, coins: 5 });
    await repo.flush();

    expect(server.paths()).toEqual(["POST /register", `PUT /streets/${street.id}`, "PUT /me"]);
    expect(server.calls[1].token).toBe("tok-1");
    expect(server.calls[2].body.player.coins).toBe(5);
  });

  it("echte Straße schon vergeben → StreetTakenError mit Namen", async () => {
    const { repo } = setup((c) => (c.path === "/register" ? { status: 409, body: { error: "street-taken", ownerName: "Zoe" } } : undefined));
    const { player, street } = start();
    await expect(repo.online.register(player, street)).rejects.toEqual(new StreetTakenError("Zoe"));
  });

  it("offline: lokal weiterspielen, später nachschicken", async () => {
    const { repo, server, make } = setup((c) =>
      c.path === "/me" && c.method === "GET" ? { status: 200, body: { player: lastPlayer, street: null, neighborhood: null, streets: [] } } : undefined,
    );
    let lastPlayer: unknown = null;
    const { player, street } = start();
    await repo.online.register(player, street);

    server.setOffline(true);
    await repo.savePlayer({ ...player, coins: 77 });
    await repo.flush();
    expect((await repo.loadPlayer())?.coins).toBe(77);

    // Neustart mit Netz: erst Ausstehendes hochladen, dann den Server-Stand übernehmen.
    server.setOffline(false);
    server.calls.length = 0;
    lastPlayer = { ...player, coins: 77 };
    const restarted = make();
    expect((await restarted.loadPlayer())?.coins).toBe(77);
    expect(server.paths()).toEqual(["PUT /me", "GET /me"]);
  });

  it("gibt die vom Server zusammengeführte Straße zurück", async () => {
    let serverStreet: Street | null = null;
    const { repo } = setup((c) => (c.method === "PUT" && c.path.startsWith("/streets/") ? { status: 200, body: { street: serverStreet, ownerName: "Zoe", names: { zoe: "Zoe", max: "Max" } } } : undefined));
    const { player, street } = start();
    await repo.online.register(player, street);
    serverStreet = { ...street, plots: street.plots.map((p, i) => (i === 1 ? { ...p, purchasedAt: 1, ownerId: "zoe" } : p)) };

    const merged = await repo.saveStreet(street);
    expect(merged).toEqual(serverStreet);
    expect(await repo.loadStreet(street.id)).toEqual(serverStreet);
    // Namen für Neuigkeiten („Max hat in deiner Straße gekauft“)
    expect(repo.online.playerNames()).toMatchObject({ zoe: "Zoe", max: "Max", [street.ownerId]: "Zoe" });
  });

  it("alter lokaler Spielstand wird beim ersten Start mit Server angemeldet", async () => {
    const storage = memoryStorage();
    const local = new LocalRepository(storage);
    const { player, street } = start();
    await local.savePlayer(player);
    await local.saveStreet(street);

    const server = fakeServer();
    const repo = new ApiRepository("https://api.test", local, storage, server.fetcher);
    expect((await repo.loadPlayer())?.id).toBe(player.id);
    expect(server.paths()).toEqual(["POST /register"]);
    expect(server.calls[0].body.street.id).toBe(street.id);
    expect(repo.online.account().status).toBe("online");
  });

  it("Straße online schon vergeben → lokal weiterspielen, nicht dauernd neu versuchen", async () => {
    const storage = memoryStorage();
    const local = new LocalRepository(storage);
    const { player, street } = start();
    await local.savePlayer(player);
    await local.saveStreet(street);
    const server = fakeServer((c) => (c.path === "/register" ? { status: 409, body: { error: "street-taken", ownerName: "Zoe" } } : undefined));

    const repo = new ApiRepository("https://api.test", local, storage, server.fetcher);
    expect((await repo.loadPlayer())?.id).toBe(player.id);
    expect(repo.online.account()).toMatchObject({ status: "street-taken", takenBy: "Zoe" });

    await new ApiRepository("https://api.test", local, storage, server.fetcher).loadPlayer();
    expect(server.calls).toHaveLength(1);
  });

  it("abgemeldetes Gerät (401) spielt lokal weiter", async () => {
    const { repo, make, server } = setup((c) => (c.method === "GET" && c.path === "/me" ? { status: 401, body: { error: "Nicht angemeldet." } } : undefined));
    const { player, street } = start();
    await repo.online.register(player, street);
    await repo.savePlayer(player);
    await repo.saveStreet(street);

    const restarted = make();
    expect((await restarted.loadPlayer())?.id).toBe(player.id);
    expect(restarted.online.account().status).toBe("signed-out");
    server.calls.length = 0;
    await restarted.savePlayer(player);
    await restarted.flush();
    expect(server.calls).toHaveLength(0);
  });

  it("Code auf neuem Gerät: Spielstand vom Server übernehmen", async () => {
    const kalle = start();
    const zoeStreet = start("Zoe").street;
    const snapshot = { player: kalle.player, street: kalle.street, neighborhood: null, streets: [{ street: zoeStreet, ownerName: "Zoe" }] };
    const { repo, server } = setup((c) =>
      c.method === "GET" && c.path === "/me"
        ? { status: 200, body: snapshot }
        : c.path === "/recover"
        ? c.body.code === "BABO-AAAA-BBBB-CCCC"
          ? {
              status: 200,
              body: { token: "tok-2", ...snapshot },
            }
          : { status: 404, body: { error: "Diesen Code kennen wir nicht." } }
        : undefined,
    );

    expect(await repo.online.recover("babo aaaa bbbb cccx")).toBe(false);
    expect(await repo.online.recover("babo aaaa bbbb cccc")).toBe(true);
    expect((await repo.loadPlayer())?.id).toBe(kalle.player.id);
    expect(await repo.online.foreignStreets()).toEqual([{ street: zoeStreet, ownerName: "Zoe" }]);
    expect(repo.online.account()).toEqual({ status: "online", recoveryCode: "BABO-AAAA-BBBB-CCCC" });
    expect(server.calls.at(-1)?.token).toBe("tok-2");
  });

  it("normalisiert Codes wie der Server", () => {
    expect(normalizeCode(" babo 7kqx-m2pd 9trw ")).toBe("BABO-7KQX-M2PD-9TRW");
    expect(normalizeCode("7KQXM2PD9TRW")).toBe("BABO-7KQX-M2PD-9TRW");
  });
});

describe("gameStore mit Server", () => {
  it("Kauf zu spät (jemand war schneller) → Geld zurück", async () => {
    const { repo } = setup((c) => {
      if (c.method !== "PUT" || !c.path.startsWith("/streets/")) return undefined;
      // Der Server kennt schon Zoes Kauf auf jedem freien Grundstück.
      const street: Street = c.body.street;
      return {
        status: 200,
        body: {
          street: { ...street, plots: street.plots.map((p) => (p.gifted ? p : { ...p, purchasedAt: 1, ownerId: "zoe" })) },
          ownerName: null,
        },
      };
    });
    const store = createGameStore(repo, () => 0, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    const coins = store.getState().player!.coins;
    const target = store.getState().street!.plots.find((p) => p.purchasedAt === undefined && p.size === "S")!;
    expect(target).toBeDefined();
    // Frischer Stand vor dem Kauf: das Grundstück ist lokal noch frei.
    store.setState({ street: { ...store.getState().street!, plots: store.getState().street!.plots.map((p) => (p.id === target.id ? { ...p, purchasedAt: undefined, ownerId: undefined } : p)) } });

    const result = await store.getState().buyPlot(target.id);

    expect(result).toEqual({ ok: false, reason: "taken" });
    expect(store.getState().player!.coins).toBe(coins);
    expect(store.getState().street!.plots.find((p) => p.id === target.id)?.ownerId).toBe("zoe");
  });

  it("Straße vergeben → claim wirft, nichts gespeichert", async () => {
    const { repo, storage } = setup((c) => (c.path === "/register" ? { status: 409, body: { error: "street-taken", ownerName: "Zoe" } } : undefined));
    const store = createGameStore(repo, () => 0, { findNeighbors: async () => [] });
    await expect(store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } })).rejects.toBeInstanceOf(StreetTakenError);
    expect(store.getState().player).toBeNull();
    expect(storage.getItem("babo:v1:player")).toBeNull();
  });
});
