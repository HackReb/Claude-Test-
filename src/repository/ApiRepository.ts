import type { Mischief, Neighborhood, Player, Street } from "../model/types";
import { PREFIX, type KeyValueStorage, type LocalRepository } from "./LocalRepository";
import { StreetTakenError, type Account, type ForeignStreet, type OnlineFeatures, type Repository } from "./Repository";

const AUTH_KEY = `${PREFIX}auth`;
const OUTBOX_KEY = `${PREFIX}outbox`;
const FOREIGN_KEY = `${PREFIX}foreign`;
const NAMES_KEY = `${PREFIX}names`;
const INBOX_KEY = `${PREFIX}inbox`;

const TIMEOUT_MS = 8000;
/** Spieler und Nachbarschaft ändern sich sekündlich (Miete) – gesammelt schicken. */
const DEBOUNCE_MS = 3000;

interface AuthState {
  token?: string;
  recoveryCode?: string;
  status?: "street-taken" | "signed-out";
  takenBy?: string;
}

/** Was noch zum Server muss; die Zahl ist eine Version, damit neuere Änderungen nicht verloren gehen. */
interface Outbox {
  player?: number;
  neighborhood?: number;
  streets: Record<string, number>;
  /** Angekommene Bad Boys, deren Verarbeitung der Server noch erfahren muss. */
  acks?: string[];
}

interface StreetEntry {
  street: Street;
  ownerName: string | null;
  /** Spieler-ID → Name der Käufer von Grundstücken in dieser Straße. */
  names?: Record<string, string>;
}

interface Snapshot {
  player: Player;
  street: Street | null;
  neighborhood: Neighborhood | null;
  streets: StreetEntry[];
  /** Bad Boys, die in der eigenen Straße angekommen sind. */
  mischief?: Mischief[];
}

/** Antwort mit Fehlerstatus (im Gegensatz zu „Server nicht erreichbar“). */
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === "string" ? body.error : `HTTP ${status}`);
  }
}

type Fetch = typeof fetch;

/**
 * Speichert beim Symfony-Server. Alles landet zuerst im lokalen Speicher (schnell, offline-fähig)
 * und geht dann zum Server; was offline nicht rausging, wird nachgeschickt.
 */
export class ApiRepository implements Repository {
  private readonly base: string;
  private auth: AuthState;
  private outbox: Outbox;
  private version: number;
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Zuletzt vom Server zusammengeführte Straßen, mit der Version, zu der sie gehören. */
  private readonly merged = new Map<string, { version: number; street: Street }>();
  readonly online: OnlineFeatures;

  constructor(
    baseUrl: string,
    private readonly cache: LocalRepository,
    private readonly storage: KeyValueStorage,
    private readonly fetcher: Fetch = (...args) => fetch(...args),
  ) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.auth = this.read<AuthState>(AUTH_KEY) ?? {};
    this.outbox = this.read<Outbox>(OUTBOX_KEY) ?? { streets: {} };
    this.version = Math.max(0, this.outbox.player ?? 0, this.outbox.neighborhood ?? 0, ...Object.values(this.outbox.streets));

    if (typeof document !== "undefined") {
      // Beim Verlassen der App nichts liegen lassen.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void this.flush();
      });
    }

    this.online = {
      account: () => this.account(),
      register: (player, street) => this.register(player, street),
      foreignStreets: () => this.foreignStreets(),
      cityStreets: (city) => this.cityStreets(city),
      fetchStreet: (id) => this.fetchStreet(id),
      recover: (code) => this.recover(code),
      playerNames: () => this.read<Record<string, string>>(NAMES_KEY) ?? {},
      incomingMischief: () => this.read<Mischief[]>(INBOX_KEY) ?? [],
      fetchMischief: () => this.fetchMischief(),
      ackMischief: (ids) => this.ackMischief(ids),
      sendMischief: (streetId, badBoyId, label) => this.sendMischief(streetId, badBoyId, label),
    };
  }

  // ---------- Repository ----------

  async loadPlayer(): Promise<Player | null> {
    try {
      if (this.auth.token) await this.sync();
      else if (!this.auth.status) await this.migrate();
    } catch (error) {
      if (!this.handleAuthError(error)) console.warn("Server nicht erreichbar – spiele mit dem lokalen Stand.", error);
    }
    return this.cache.loadPlayer();
  }

  async savePlayer(player: Player): Promise<void> {
    await this.cache.savePlayer(player);
    this.outbox.player = this.nextVersion();
    this.persistOutbox();
    this.scheduleFlush();
  }

  loadStreet(id: string): Promise<Street | null> {
    return this.cache.loadStreet(id);
  }

  async saveStreet(street: Street): Promise<Street | void> {
    await this.cache.saveStreet(street);
    const version = this.nextVersion();
    this.outbox.streets[street.id] = version;
    this.persistOutbox();
    if (!this.auth.token) return;
    await this.flush();
    const merged = this.merged.get(street.id);
    return merged?.version === version ? merged.street : undefined;
  }

  listStreets(): Promise<Street[]> {
    return this.cache.listStreets();
  }

  loadNeighborhood(): Promise<Neighborhood | null> {
    return this.cache.loadNeighborhood();
  }

  async saveNeighborhood(neighborhood: Neighborhood): Promise<void> {
    await this.cache.saveNeighborhood(neighborhood);
    this.outbox.neighborhood = this.nextVersion();
    this.persistOutbox();
    this.scheduleFlush();
  }

  async reset(): Promise<void> {
    if (this.auth.token) {
      await this.request("DELETE", "/me").catch((error) => console.warn("Spielstand auf dem Server nicht gelöscht", error));
    }
    this.auth = {};
    this.outbox = { streets: {} };
    this.merged.clear();
    this.storage.removeItem(AUTH_KEY);
    this.storage.removeItem(OUTBOX_KEY);
    this.storage.removeItem(FOREIGN_KEY);
    this.storage.removeItem(NAMES_KEY);
    this.storage.removeItem(INBOX_KEY);
    await this.cache.reset();
  }

  /** Alles Ausstehende jetzt zum Server schicken (der Reihe nach, nie parallel). */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const run = this.queue.then(() => this.flushNow());
    this.queue = run.catch(() => undefined);
    return run.catch((error) => {
      if (!this.handleAuthError(error)) console.warn("Speichern auf dem Server fehlgeschlagen – wird nachgeholt.", error);
    });
  }

  // ---------- Online ----------

  private account(): Account {
    const status = this.auth.status ?? (this.auth.token ? "online" : "pending");
    return { status, recoveryCode: this.auth.recoveryCode, takenBy: this.auth.takenBy };
  }

  private async register(player: Player, street: Street): Promise<void> {
    try {
      await this.registerDocs({ player, street });
    } catch (error) {
      if (error instanceof StreetTakenError) throw error;
      // Server nicht erreichbar: lokal loslegen, angemeldet wird beim nächsten Start.
      console.warn("Anmeldung beim Server fehlgeschlagen – wird nachgeholt.", error);
    }
  }

  private async foreignStreets(): Promise<ForeignStreet[]> {
    const owners = this.read<Record<string, string>>(FOREIGN_KEY) ?? {};
    const streets = await Promise.all(
      Object.entries(owners).map(async ([id, ownerName]) => {
        const street = await this.cache.loadStreet(id);
        return street ? { street, ownerName } : null;
      }),
    );
    return streets.filter((s): s is ForeignStreet => s !== null);
  }

  private async cityStreets(city: string): Promise<ForeignStreet[]> {
    if (!this.auth.token) return [];
    const { streets } = await this.request<{ streets: StreetEntry[] }>("GET", `/city?name=${encodeURIComponent(city)}`);
    this.learnNames(streets);
    return streets.filter((e): e is ForeignStreet => e.ownerName !== null);
  }

  private async fetchStreet(id: string) {
    if (!this.auth.token) return null;
    await this.flush();
    try {
      const entry = await this.request<StreetEntry>("GET", `/streets/${encodeURIComponent(id)}`);
      this.learnNames([entry]);
      // Nur übernehmen, wenn lokal nichts Neueres wartet.
      if (this.outbox.streets[id] === undefined && (await this.cache.loadStreet(id))) await this.cache.saveStreet(entry.street);
      return entry;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  private async recover(code: string): Promise<boolean> {
    try {
      const normalized = normalizeCode(code);
      const result = await this.request<Snapshot & { token: string }>("POST", "/recover", { code: normalized }, false);
      await this.cache.reset();
      this.outbox = { streets: {} };
      this.persistOutbox();
      this.setAuth({ token: result.token, recoveryCode: normalized });
      await this.writeSnapshot(result);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return false;
      throw error;
    }
  }

  private async fetchMischief(): Promise<Mischief[]> {
    if (!this.auth.token) return [];
    const { mischief } = await this.request<{ mischief: Mischief[] }>("GET", "/me/mischief");
    this.receiveMischief(mischief);
    return this.read<Mischief[]>(INBOX_KEY) ?? [];
  }

  /** Verarbeitete Bad Boys aus dem Posteingang nehmen; der Server erfährt es beim nächsten Senden. */
  private async ackMischief(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const inbox = this.read<Mischief[]>(INBOX_KEY) ?? [];
    this.write(INBOX_KEY, inbox.filter((m) => !ids.includes(m.id)));
    this.outbox.acks = [...new Set([...(this.outbox.acks ?? []), ...ids])];
    this.persistOutbox();
    this.scheduleFlush();
  }

  private async sendMischief(streetId: string, badBoyId: string, label?: string) {
    try {
      const body = label ? { badBoy: badBoyId, label } : { badBoy: badBoyId };
      const { mischief } = await this.request<{ mischief: Mischief }>("POST", `/streets/${encodeURIComponent(streetId)}/mischief`, body);
      return { ok: true as const, mischief };
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) return { ok: false as const, message: error.message };
      return { ok: false as const, message: "Der Server ist gerade nicht erreichbar." };
    }
  }

  private receiveMischief(list: Mischief[] | undefined) {
    if (!list?.length) return;
    const inbox = this.read<Mischief[]>(INBOX_KEY) ?? [];
    const done = new Set(this.outbox.acks ?? []);
    const known = new Set(inbox.map((m) => m.id));
    this.write(INBOX_KEY, [...inbox, ...list.filter((m) => !known.has(m.id) && !done.has(m.id))]);
  }

  // ---------- intern ----------

  private async registerDocs(docs: { player: Player; street: Street; neighborhood?: Neighborhood | null; streets?: Street[] }) {
    try {
      const result = await this.request<{ token: string; recoveryCode: string }>("POST", "/register", docs, false);
      this.setAuth({ token: result.token, recoveryCode: result.recoveryCode });
      // Alles, was bei der Anmeldung dabei war, ist jetzt auf dem Server.
      this.outbox = { streets: {} };
      this.persistOutbox();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.body.error === "street-taken") {
        const owner = typeof error.body.ownerName === "string" ? error.body.ownerName : null;
        throw new StreetTakenError(owner);
      }
      throw error;
    }
  }

  /** Lokaler Spielstand von vor dem Server (oder offline angelegt) → beim Server anmelden. */
  private async migrate(): Promise<void> {
    const player = await this.cache.loadPlayer();
    const street = player && (await this.cache.loadStreet(player.streetId));
    if (!player || !street) return;
    const neighborhood = await this.cache.loadNeighborhood();
    const streets = neighborhood ? await Promise.all(neighborhood.bots.map((b) => this.cache.loadStreet(b.streetId))) : [];
    try {
      await this.registerDocs({ player, street, neighborhood, streets: streets.filter((s): s is Street => s !== null) });
    } catch (error) {
      if (!(error instanceof StreetTakenError)) throw error;
      this.setAuth({ status: "street-taken", takenBy: error.ownerName ?? undefined });
    }
  }

  /** Ausstehendes hochladen, dann den Stand vom Server übernehmen (er kann von einem anderen Gerät kommen). */
  private async sync(): Promise<void> {
    await this.queue.then(() => this.flushNow());
    await this.writeSnapshot(await this.request<Snapshot>("GET", "/me"));
  }

  private async writeSnapshot(snapshot: Snapshot): Promise<void> {
    if (!snapshot?.player?.id || !Array.isArray(snapshot.streets)) throw new Error("Ungültige Antwort vom Server");
    await this.cache.savePlayer(snapshot.player);
    if (snapshot.street) await this.cache.saveStreet(snapshot.street);
    if (snapshot.neighborhood) await this.cache.saveNeighborhood(snapshot.neighborhood);
    this.learnNames(snapshot.streets);
    this.receiveMischief(snapshot.mischief);
    const owners: Record<string, string> = {};
    for (const entry of snapshot.streets) {
      await this.cache.saveStreet(entry.street);
      if (entry.ownerName !== null) owners[entry.street.id] = entry.ownerName;
    }
    this.write(FOREIGN_KEY, owners);
  }

  private async flushNow(): Promise<void> {
    if (!this.auth.token) return;
    for (const [id, version] of Object.entries(this.outbox.streets)) {
      const street = await this.cache.loadStreet(id);
      try {
        if (street) {
          const entry = await this.request<StreetEntry>("PUT", `/streets/${encodeURIComponent(id)}`, { street });
          this.learnNames([entry]);
          this.merged.set(id, { version, street: entry.street });
          if (this.outbox.streets[id] === version) await this.cache.saveStreet(entry.street);
          const me = (await this.cache.loadPlayer())?.id;
          if (entry.ownerName !== null && entry.street.ownerId !== me) this.rememberForeign(id, entry.ownerName);
        }
      } catch (error) {
        if (!this.isRejected(error)) throw error;
        console.warn(`Server hat Straße ${id} abgelehnt`, error);
      }
      this.done("street", version, id);
    }

    const playerVersion = this.outbox.player;
    if (playerVersion !== undefined) {
      const player = await this.cache.loadPlayer();
      if (player) await this.request("PUT", "/me", { player }).catch((error) => this.rethrowUnlessRejected(error));
      this.done("player", playerVersion);
    }

    const acks = this.outbox.acks ?? [];
    if (acks.length > 0) {
      await this.request("POST", "/me/mischief/ack", { ids: acks }).catch((error) => this.rethrowUnlessRejected(error));
      this.outbox.acks = (this.outbox.acks ?? []).filter((id) => !acks.includes(id));
      this.persistOutbox();
    }

    const hoodVersion = this.outbox.neighborhood;
    if (hoodVersion !== undefined) {
      const neighborhood = await this.cache.loadNeighborhood();
      if (neighborhood) await this.request("PUT", "/me/neighborhood", { neighborhood }).catch((error) => this.rethrowUnlessRejected(error));
      this.done("neighborhood", hoodVersion);
    }
  }

  /** Erledigt – außer es kam inzwischen eine neuere Änderung dazu. */
  private done(kind: "street" | "player" | "neighborhood", version: number, id?: string) {
    if (kind === "street" && id && this.outbox.streets[id] === version) delete this.outbox.streets[id];
    if (kind === "player" && this.outbox.player === version) delete this.outbox.player;
    if (kind === "neighborhood" && this.outbox.neighborhood === version) delete this.outbox.neighborhood;
    this.persistOutbox();
  }

  /** 4xx (außer 401): der Server will das nicht – nicht endlos erneut schicken. */
  private isRejected(error: unknown) {
    return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401;
  }

  private rethrowUnlessRejected(error: unknown) {
    if (!this.isRejected(error)) throw error;
    console.warn("Server hat die Änderung abgelehnt", error);
  }

  /** 401: Schlüssel ungültig (z. B. Code auf einem anderen Gerät benutzt). */
  private handleAuthError(error: unknown): boolean {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    this.setAuth({ recoveryCode: this.auth.recoveryCode, status: "signed-out" });
    return true;
  }

  /** Namen von Straßenbesitzern und Käufern merken – für Neuigkeiten wie „Maxim hat bei dir gekauft“. */
  private learnNames(entries: StreetEntry[]) {
    const known = this.read<Record<string, string>>(NAMES_KEY) ?? {};
    const next = { ...known };
    for (const entry of entries) {
      if (entry.ownerName !== null) next[entry.street.ownerId] = entry.ownerName;
      Object.assign(next, entry.names ?? {});
    }
    if (Object.keys(next).some((id) => next[id] !== known[id])) this.write(NAMES_KEY, next);
  }

  private rememberForeign(id: string, ownerName: string) {
    const owners = this.read<Record<string, string>>(FOREIGN_KEY) ?? {};
    if (owners[id] !== ownerName) this.write(FOREIGN_KEY, { ...owners, [id]: ownerName });
  }

  private scheduleFlush() {
    if (!this.auth.token || this.timer) return;
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  private nextVersion() {
    return ++this.version;
  }

  private setAuth(auth: AuthState) {
    this.auth = auth;
    this.write(AUTH_KEY, auth);
  }

  private persistOutbox() {
    this.write(OUTBOX_KEY, this.outbox);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown, withToken = true): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (withToken && this.auth.token) headers.Authorization = `Bearer ${this.auth.token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetcher(`${this.base}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new ApiError(response.status, data);
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.storage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown) {
    this.storage.setItem(key, JSON.stringify(value));
  }
}

/** „babo 7kqx m2pd 9trw“ → „BABO-7KQX-M2PD-9TRW“ (wie der Server). */
export function normalizeCode(code: string): string {
  let clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.startsWith("BABO")) clean = clean.slice(4);
  return ["BABO", ...(clean.match(/.{1,4}/g) ?? [])].join("-");
}
