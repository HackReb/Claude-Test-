import type { Mischief, Neighborhood, Player, Street } from "../model/types";
import { PREFIX, type KeyValueStorage, type LocalRepository } from "./LocalRepository";
import { ClaimRejectedError, StreetTakenError, type Account, type AccountResult, type AccountStreet, type ForeignStreet, type OnlineFeatures, type Repository } from "./Repository";

const AUTH_KEY = `${PREFIX}auth`;
const OUTBOX_KEY = `${PREFIX}outbox`;
const FOREIGN_KEY = `${PREFIX}foreign`;
const NAMES_KEY = `${PREFIX}names`;
const INBOX_KEY = `${PREFIX}inbox`;

const TIMEOUT_MS = 8000;
/** Spieler und Nachbarschaft ändern sich sekündlich (Miete) – gesammelt schicken. */
const DEBOUNCE_MS = 3000;

interface AuthState {
  /** Konto-Sitzung dieses Geräts. */
  session?: string;
  /** Mit Sitzung: die gerade gespielte Straße (Spieler-ID). */
  playerId?: string;
  accountName?: string;
  streets?: AccountStreet[];
  maxStreets?: number;
  /** Älterer Geräte-Schlüssel eines einzelnen Spielstands (bis das Konto eingerichtet ist). */
  token?: string;
  recoveryCode?: string;
  status?: "street-taken" | "signed-out";
  takenBy?: string;
}

interface AccountResponse {
  token?: string;
  account: { name: string; maxStreets: number };
  streets: AccountStreet[];
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
  /**
   * Zuletzt lokal gespeicherte Straßen mit Zähler. Wird eine Straße gespeichert, während eine Antwort
   * vom Server unterwegs ist, ist diese Antwort veraltet und darf die Änderung nicht überschreiben
   * (sonst kommt z. B. ein gerade repariertes Fenster wieder kaputt zurück).
   */
  private readonly localEdits = new Map<string, { count: number; street: Street }>();
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
      signOut: () => this.signOut(),
      login: (name, password) => this.login(name, password),
      createAccount: (name, password) => this.createAccount(name, password),
      refreshAccount: () => this.refreshAccount(),
      selectStreet: (playerId) => this.selectStreet(playerId),
      startNewStreet: () => this.startNewStreet(),
      attachCode: (code) => this.attachCode(code),
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
      if (this.canSync()) await this.sync();
      // Alter lokaler Spielstand (von vor dem Server): mit Konto beim Server anmelden.
      else if (this.auth.session && !this.auth.status) await this.migrate();
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
    this.localEdits.set(street.id, { count: (this.localEdits.get(street.id)?.count ?? 0) + 1, street });
    await this.cache.saveStreet(street);
    const version = this.nextVersion();
    this.outbox.streets[street.id] = version;
    this.persistOutbox();
    if (!this.canSync()) return;
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
    if (this.canSync()) {
      await this.request("DELETE", "/me").catch((error) => console.warn("Spielstand auf dem Server nicht gelöscht", error));
    }
    if (this.auth.session) {
      // Nur diese Straße ist weg – das Konto bleibt angemeldet und hat wieder einen Platz frei.
      await this.clearStreetData();
      this.setAuth({ ...this.auth, playerId: undefined, streets: (this.auth.streets ?? []).filter((s) => s.playerId !== this.auth.playerId) });
      await this.refreshAccount().catch(() => undefined);
      return;
    }
    await this.clearDevice();
  }

  /** Abmelden: erst alles hochladen, dann das Gerät leeren. Mit Konto wird auch die Sitzung beendet. */
  private async signOut(): Promise<boolean> {
    if (!(await this.uploadEverything())) return false;
    if (this.auth.session) await this.request("POST", "/account/logout").catch(() => undefined);
    await this.clearDevice();
    return true;
  }

  /** Alles Ausstehende hochladen; false = ging nicht (Server nicht erreichbar), dann nichts löschen. */
  private async uploadEverything(): Promise<boolean> {
    // Noch nie beim Server angekommen: Abmelden würde den Spielstand verlieren.
    if (!this.canSync() && !this.auth.session && this.auth.status !== "signed-out") return false;
    if (!this.canSync()) return true;
    // Ein bereits abgemeldetes Gerät darf nichts mehr hochladen – dort wird nur aufgeräumt.
    if (this.auth.status !== "signed-out") {
      // Was während des Hochladens noch gespeichert wird, kommt in der nächsten Runde mit.
      for (let round = 0; round < 3 && this.hasPending(); round++) await this.flush();
      // flush() kann das Gerät abmelden (401) – dann ist ohnehin nichts mehr zu retten.
      if ((this.auth.status as string | undefined) !== "signed-out" && this.hasPending()) return false;
    }
    return true;
  }

  private hasPending(): boolean {
    const o = this.outbox;
    return Object.keys(o.streets).length > 0 || o.player !== undefined || o.neighborhood !== undefined || (o.acks?.length ?? 0) > 0;
  }

  /** Alles auf diesem Gerät vergessen (der Server bleibt unberührt). */
  private async clearDevice(): Promise<void> {
    this.auth = {};
    this.storage.removeItem(AUTH_KEY);
    await this.clearStreetData();
  }

  /** Den Spielstand der aktuellen Straße vom Gerät nehmen (Sitzung bleibt). */
  private async clearStreetData(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.outbox = { streets: {} };
    this.merged.clear();
    this.localEdits.clear();
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

  /** Kann dieses Gerät mit dem Server sprechen – mit Konto und gewählter Straße oder mit altem Geräte-Schlüssel? */
  private canSync(): boolean {
    return this.auth.status !== "signed-out" && (!!(this.auth.session && this.auth.playerId) || !!this.auth.token);
  }

  private account(): Account {
    const { session, playerId, token } = this.auth;
    const status =
      this.auth.status ?? (session ? (playerId ? "online" : "choose") : token ? "legacy" : "logged-out");
    return {
      status,
      recoveryCode: this.auth.recoveryCode,
      takenBy: this.auth.takenBy,
      ...(session && { name: this.auth.accountName, streets: this.auth.streets ?? [], maxStreets: this.auth.maxStreets ?? 3, activePlayerId: playerId }),
    };
  }

  // ---------- Konto ----------

  private async createAccount(name: string, password: string): Promise<AccountResult> {
    // Ein älterer Spielstand auf diesem Gerät kommt über seinen Geräte-Schlüssel mit ins Konto.
    return this.signIn("POST", "/account/register", { name, password }, !!this.auth.token);
  }

  private async login(name: string, password: string): Promise<AccountResult> {
    return this.signIn("POST", "/account/login", { name, password }, false);
  }

  private async signIn(method: string, path: string, body: unknown, withLegacyToken: boolean): Promise<AccountResult> {
    try {
      const result = await this.request<AccountResponse>(method, path, body, withLegacyToken);
      const local = await this.cache.loadPlayer();
      // Spielt dieses Gerät gerade eine der Straßen des Kontos, geht es nahtlos weiter.
      const keep = local && result.streets.some((s) => s.playerId === local.id) ? local.id : undefined;
      // Ein Spielstand, der schon beim Server liegt, aber nicht zu diesem Konto gehört, bleibt dort (per Code anhängbar).
      // Ein nur lokaler Spielstand bleibt dagegen hier und wird gleich mit dem Konto angemeldet.
      if (!keep && local && this.auth.token) await this.clearStreetData();
      this.setAuth({
        session: result.token,
        playerId: keep,
        accountName: result.account.name,
        streets: result.streets,
        maxStreets: result.account.maxStreets,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  }

  private async refreshAccount(): Promise<void> {
    if (!this.auth.session) return;
    try {
      const result = await this.request<AccountResponse>("GET", "/account");
      this.setAuth({ ...this.auth, accountName: result.account.name, streets: result.streets, maxStreets: result.account.maxStreets });
    } catch (error) {
      if (!this.handleAuthError(error)) throw error;
    }
  }

  /** Zu einer anderen Straße des Kontos wechseln: erst alles hochladen, dann ihren Stand vom Server holen. */
  private async selectStreet(playerId: string): Promise<boolean> {
    if (!this.auth.session) return false;
    if (playerId === this.auth.playerId) return true;
    if (!(await this.uploadEverything())) return false;
    await this.clearStreetData();
    this.setAuth({ ...this.auth, playerId });
    try {
      await this.sync();
      return true;
    } catch (error) {
      this.setAuth({ ...this.auth, playerId: undefined });
      if (!this.handleAuthError(error)) console.warn("Straße konnte nicht geladen werden", error);
      return false;
    }
  }

  /** Platz machen für eine neue Straße: aktuelle hochladen und vom Gerät nehmen, das Konto bleibt angemeldet. */
  private async startNewStreet(): Promise<boolean> {
    if (!this.auth.session) return false;
    if (!(await this.uploadEverything())) return false;
    await this.clearStreetData();
    this.setAuth({ ...this.auth, playerId: undefined });
    return true;
  }

  /** Eine ältere Straße per BABO-Code ans Konto hängen. */
  private async attachCode(code: string): Promise<AccountResult> {
    try {
      const result = await this.request<AccountResponse>("POST", "/account/attach", { code: normalizeCode(code) });
      this.setAuth({ ...this.auth, streets: result.streets, maxStreets: result.account.maxStreets });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  }

  private async register(player: Player, street: Street): Promise<void> {
    try {
      await this.registerDocs({ player, street });
    } catch (error) {
      if (error instanceof StreetTakenError) throw error;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw new ClaimRejectedError(error.message);
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
    if (!this.canSync()) return [];
    const { streets } = await this.request<{ streets: StreetEntry[] }>("GET", `/city?name=${encodeURIComponent(city)}`);
    this.learnNames(streets);
    return streets.filter((e): e is ForeignStreet => e.ownerName !== null);
  }

  private async fetchStreet(id: string) {
    if (!this.canSync()) return null;
    await this.flush();
    const edits = this.editCounts();
    try {
      const entry = await this.request<StreetEntry>("GET", `/streets/${encodeURIComponent(id)}`);
      this.learnNames([entry]);
      // Inzwischen lokal gespeichert? Dann gilt der lokale Stand – der Server bekommt ihn gleich.
      const local = this.editedSince(edits, id);
      if (local) return { ...entry, street: local };
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
    if (!this.canSync()) return [];
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
      if (this.auth.session) {
        await this.request("POST", "/register", docs);
        const entry: AccountStreet = {
          playerId: docs.player.id,
          playerName: docs.player.name,
          streetId: docs.street.id,
          streetName: docs.street.name,
          city: docs.street.city,
        };
        this.setAuth({ ...this.auth, playerId: docs.player.id, streets: [...(this.auth.streets ?? []), entry], status: undefined });
      } else {
        const result = await this.request<{ token: string; recoveryCode: string }>("POST", "/register", docs, false);
        this.setAuth({ token: result.token, recoveryCode: result.recoveryCode });
      }
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
    const edits = this.editCounts();
    await this.writeSnapshot(await this.request<Snapshot>("GET", "/me"), edits);
  }

  /** Stand vom Server in den lokalen Speicher – außer Straßen, die inzwischen lokal geändert wurden. */
  private async writeSnapshot(snapshot: Snapshot, edits?: Map<string, number>): Promise<void> {
    if (!snapshot?.player?.id || !Array.isArray(snapshot.streets)) throw new Error("Ungültige Antwort vom Server");
    const keepLocal = (id: string) => edits !== undefined && (this.outbox.streets[id] !== undefined || this.editedSince(edits, id) !== null);
    await this.cache.savePlayer(snapshot.player);
    if (snapshot.street && !keepLocal(snapshot.street.id)) await this.cache.saveStreet(snapshot.street);
    if (snapshot.neighborhood) await this.cache.saveNeighborhood(snapshot.neighborhood);
    this.learnNames(snapshot.streets);
    this.receiveMischief(snapshot.mischief);
    const owners: Record<string, string> = {};
    for (const entry of snapshot.streets) {
      if (!keepLocal(entry.street.id)) await this.cache.saveStreet(entry.street);
      if (entry.ownerName !== null) owners[entry.street.id] = entry.ownerName;
    }
    this.write(FOREIGN_KEY, owners);
  }

  private async flushNow(): Promise<void> {
    if (!this.canSync()) return;
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

  /** 401: Schlüssel ungültig (Code auf einem anderen Gerät benutzt, Sitzung beendet, neues Passwort). */
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

  private editCounts(): Map<string, number> {
    return new Map([...this.localEdits].map(([id, e]) => [id, e.count]));
  }

  /** Die lokal gespeicherte Straße, wenn sie seit `edits` geändert wurde – sonst null. */
  private editedSince(edits: Map<string, number>, id: string): Street | null {
    const now = this.localEdits.get(id);
    return now && now.count !== (edits.get(id) ?? 0) ? now.street : null;
  }

  private scheduleFlush() {
    if (!this.canSync() || this.timer) return;
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
    if (withToken) {
      if (this.auth.session) {
        headers.Authorization = `Bearer ${this.auth.session}`;
        if (this.auth.playerId) headers["X-Babo-Player"] = this.auth.playerId;
      } else if (this.auth.token) {
        headers.Authorization = `Bearer ${this.auth.token}`;
      }
    }
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

/** Fehlermeldung des Servers für die Anzeige. */
function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.status >= 500 ? "Der Server hat gerade ein Problem. Versuch es gleich nochmal." : error.message;
  return "Der Server ist gerade nicht erreichbar.";
}

/** „babo 7kqx m2pd 9trw“ → „BABO-7KQX-M2PD-9TRW“ (wie der Server). */
export function normalizeCode(code: string): string {
  let clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.startsWith("BABO")) clean = clean.slice(4);
  return ["BABO", ...(clean.match(/.{1,4}/g) ?? [])].join("-");
}
