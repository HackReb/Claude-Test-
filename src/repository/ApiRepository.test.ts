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
  /** Gewählte Straße (Header X-Babo-Player). */
  player: string | null;
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
      player: (init.headers as Record<string, string>)["X-Babo-Player"] ?? null,
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

const ACCOUNT = { name: "Kalle", maxStreets: 3 };

function defaultReply(call: Call): Reply {
  if (call.path === "/account/login" || call.path === "/account/register") return { status: 200, body: { token: "sess-1", account: ACCOUNT, streets: [] } };
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
  it("Konto: anmelden, Straße claimen, dann mit Sitzung + gewählter Straße speichern", async () => {
    const { repo, server } = setup();
    expect(repo.online.account().status).toBe("logged-out");
    expect(await repo.online.login("Kalle", "geheim123")).toEqual({ ok: true });
    expect(repo.online.account()).toMatchObject({ status: "choose", name: "Kalle", streets: [], maxStreets: 3 });

    const { player, street } = start();
    await repo.online.register(player, street);
    expect(repo.online.account()).toMatchObject({ status: "online", activePlayerId: player.id, streets: [{ playerId: player.id, streetName: "Weg" }] });
    await repo.savePlayer({ ...player, coins: 5 });
    await repo.flush();
    expect(server.paths()).toEqual(["POST /account/login", "POST /register", "PUT /me"]);
    expect(server.calls[1]).toMatchObject({ token: "sess-1", player: null });
    expect(server.calls[2]).toMatchObject({ token: "sess-1", player: player.id });
  });

  it("falsches Passwort: Meldung vom Server", async () => {
    const { repo } = setup((c) => (c.path === "/account/login" ? { status: 401, body: { error: "Name oder Passwort stimmt nicht." } } : undefined));
    expect(await repo.online.login("Kalle", "falsch")).toEqual({ ok: false, message: "Name oder Passwort stimmt nicht." });
    expect(repo.online.account().status).toBe("logged-out");
  });

  it("Straßen wechseln, neue Straße anfangen, Code anhängen, abmelden", async () => {
    const kalle = start();
    const other = start("Kalle");
    const streets = [
      { playerId: kalle.player.id, playerName: "Kalle", streetId: kalle.street.id, streetName: "Weg", city: "Ulm" },
      { playerId: other.player.id, playerName: "Kalle", streetId: other.street.id, streetName: "Weg", city: "Ulm" },
    ];
    const snapshotOf = (id: string | null) => {
      const s = id === other.player.id ? other : kalle;
      return { player: s.player, street: s.street, neighborhood: null, streets: [] };
    };
    const { repo, server } = setup((c) =>
      c.path === "/account/login"
        ? { status: 200, body: { token: "sess-1", account: ACCOUNT, streets } }
        : c.method === "GET" && c.path === "/me"
          ? { status: 200, body: snapshotOf(c.player) }
          : c.path === "/account/attach"
            ? c.body.code === "BABO-AAAA-BBBB-CCCC"
              ? { status: 200, body: { account: ACCOUNT, streets: [...streets, { ...streets[0], playerId: "p3" }] } }
              : { status: 409, body: { error: "Diese Straße gehört schon zu einem anderen Konto." } }
            : undefined,
    );
    await repo.online.login("Kalle", "geheim123");
    expect(await repo.online.selectStreet(kalle.player.id)).toBe(true);
    expect((await repo.loadPlayer())?.id).toBe(kalle.player.id);
    await repo.savePlayer({ ...kalle.player, coins: 42 });

    // Wechsel: erst wird hochgeladen, dann die andere Straße geholt.
    expect(await repo.online.selectStreet(other.player.id)).toBe(true);
    expect(server.calls.find((c) => c.method === "PUT" && c.path === "/me")).toMatchObject({ player: kalle.player.id });
    expect((await repo.loadPlayer())?.id).toBe(other.player.id);
    expect(repo.online.account().activePlayerId).toBe(other.player.id);

    // Neue Straße: das Gerät wird frei, das Konto bleibt angemeldet.
    expect(await repo.online.startNewStreet()).toBe(true);
    expect(await repo.loadPlayer()).toBeNull();
    expect(repo.online.account().status).toBe("choose");

    expect(await repo.online.attachCode("babo aaaa bbbb cccc")).toEqual({ ok: true });
    expect(repo.online.account().streets).toHaveLength(3);
    expect(await repo.online.attachCode("BABO-XXXX-XXXX-XXXX")).toEqual({ ok: false, message: "Diese Straße gehört schon zu einem anderen Konto." });

    expect(await repo.online.signOut()).toBe(true);
    expect(server.paths()).toContain("POST /account/logout");
    expect(repo.online.account().status).toBe("logged-out");
  });

  it("älterer Spielstand ohne Konto: spielt mit Geräte-Schlüssel, Konto einrichten nimmt ihn mit", async () => {
    const { repo, server } = setup((c) =>
      c.path === "/account/register" ? { status: 201, body: { token: "sess-9", account: ACCOUNT, streets: [{ playerId: c.body && lastId, playerName: "Kalle", streetId: "s", streetName: "Weg", city: "Ulm" }] } } : undefined,
    );
    let lastId = "";
    const { player, street } = start();
    lastId = player.id;
    await repo.online.register(player, street);
    expect(repo.online.account()).toEqual({ status: "legacy", recoveryCode: "BABO-AAAA-BBBB-CCCC" });

    await repo.saveStreet(street);
    await repo.savePlayer({ ...player, coins: 5 });
    await repo.flush();
    expect(server.paths()).toEqual(["POST /register", `PUT /streets/${street.id}`, "PUT /me"]);
    expect(server.calls[1].token).toBe("tok-1");
    expect(server.calls[2].body.player.coins).toBe(5);

    // Konto einrichten: der alte Geräte-Schlüssel geht mit, danach läuft alles über die Sitzung.
    expect(await repo.online.createAccount("Kalle", "geheim123")).toEqual({ ok: true });
    expect(server.calls.at(-1)).toMatchObject({ path: "/account/register", token: "tok-1" });
    expect(repo.online.account()).toMatchObject({ status: "online", activePlayerId: player.id });
    expect((await repo.loadPlayer())?.coins).toBe(5);
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
    // Ohne Konto passiert nichts – nach dem Anmelden kommt der lokale Spielstand mit ins Konto.
    expect((await repo.loadPlayer())?.id).toBe(player.id);
    expect(server.paths()).toEqual([]);
    await repo.online.login("Kalle", "geheim123");
    expect((await repo.loadPlayer())?.id).toBe(player.id);
    expect(server.paths()).toEqual(["POST /account/login", "POST /register"]);
    expect(server.calls[1].body.street.id).toBe(street.id);
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
    await repo.online.login("Kalle", "geheim123");
    expect((await repo.loadPlayer())?.id).toBe(player.id);
    expect(repo.online.account()).toMatchObject({ status: "street-taken", takenBy: "Zoe" });

    await new ApiRepository("https://api.test", local, storage, server.fetcher).loadPlayer();
    expect(server.calls).toHaveLength(2);
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

  it("Abmelden: erst alles hochladen, dann nur das Gerät leeren – der Server behält den Spielstand", async () => {
    const { repo, server } = setup();
    const { player, street } = start();
    await repo.online.register(player, street);
    await repo.savePlayer({ ...player, coins: 7 });

    server.setOffline(true);
    expect(await repo.online.signOut()).toBe(false); // nichts verloren, noch angemeldet
    expect((await repo.loadPlayer())?.coins).toBe(7);
    expect(repo.online.account().status).toBe("legacy");

    server.setOffline(false);
    expect(await repo.online.signOut()).toBe(true);
    expect(server.paths()).not.toContain("DELETE /me");
    expect(server.calls.filter((c) => c.path === "/me" && c.method === "PUT").at(-1)?.body.player.coins).toBe(7);
    expect(await repo.loadPlayer()).toBeNull();
    expect(repo.online.account()).toEqual({ status: "logged-out", recoveryCode: undefined, takenBy: undefined });
  });

  it("Spiel: Abmelden führt zurück zum Start, mit dem Code geht es weiter", async () => {
    const { repo } = setup();
    const store = createGameStore(repo, () => 0, { findNeighbors: async () => [] });
    await store.getState().claim({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } });
    await new Promise((r) => setTimeout(r, 20)); // Nachbarschaft entsteht im Hintergrund
    expect(await store.getState().signOut()).toBe(true);
    expect(store.getState().player).toBeNull();
    expect(store.getState().street).toBeNull();
  });

  it("abgemeldetes Gerät (Code woanders benutzt) räumt beim Abmelden nur auf", async () => {
    const { repo, server } = setup((c) => (c.method === "PUT" ? { status: 401, body: { error: "Unbekannter Schlüssel" } } : undefined));
    const { player, street } = start();
    await repo.online.register(player, street);
    await repo.savePlayer({ ...player, coins: 7 });
    await repo.flush();
    expect(repo.online.account().status).toBe("signed-out");

    const before = server.calls.length;
    expect(await repo.online.signOut()).toBe(true);
    expect(server.calls.length).toBe(before);
    expect(await repo.loadPlayer()).toBeNull();
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
    expect(repo.online.account()).toEqual({ status: "legacy", recoveryCode: "BABO-AAAA-BBBB-CCCC" });
    expect(server.calls.at(-1)?.token).toBe("tok-2");
  });

  it("Bad Boys: schicken, Posteingang und Bestätigung (auch offline nachgereicht)", async () => {
    const kevin = { id: "m1", badBoyId: "spruehdosen-kevin", at: 5, blocked: false, senderName: "Maxim" };
    const { repo, server } = setup((c) => {
      if (c.path === "/streets/street-x/mischief") return { status: 201, body: { mischief: { ...kevin, id: "m9" } } };
      if (c.path === "/streets/street-y/mischief") return { status: 429, body: { error: "Deine Bad Boys brauchen eine Pause." } };
      if (c.path === "/me/mischief") return { status: 200, body: { mischief: [kevin] } };
      return undefined;
    });
    const { player, street } = start();
    await repo.online.register(player, street);

    expect(await repo.online.sendMischief("street-x", "spruehdosen-kevin")).toMatchObject({ ok: true, mischief: { id: "m9" } });
    expect(await repo.online.sendMischief("street-y", "gassi-gabi")).toEqual({ ok: false, message: "Deine Bad Boys brauchen eine Pause." });

    expect(await repo.online.fetchMischief()).toEqual([kevin]);
    server.setOffline(true);
    await repo.online.ackMischief(["m1"]);
    await repo.flush();
    expect(repo.online.incomingMischief()).toEqual([]);
    // Noch nicht bestätigt beim Server → kommt beim Abholen nicht wieder rein
    server.setOffline(false);
    expect(await repo.online.fetchMischief()).toEqual([]);
    await repo.flush();
    expect(server.calls.find((c) => c.path === "/me/mischief/ack")?.body).toEqual({ ids: ["m1"] });
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
