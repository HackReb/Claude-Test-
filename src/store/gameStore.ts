import { create } from "zustand";
import { claimStreet, verifyStreet, type ClaimInput } from "../game/claimStreet";
import { migrateSave } from "../game/migrate";
import { createNeighborhood, simulateNeighborhood } from "../game/bots";
import {
  belongsTo,
  buyPlot,
  currentPrice,
  placeBuilding,
  renameBuilding,
  upgradePlot,
  type BuyResult,
  type UpgradeResult,
} from "../game/plots";
import { BOTS, personaOf } from "../config/bots";
import { addLitter, buildPlayground, tapLitter, type AmenityResult, type CleanResult } from "../game/life";
import { collectRent, simulate } from "../game/rent";
import { unlockPart, type UnlockResult } from "../game/unlock";
import { buyCar, updateCar, type BuyCarResult } from "../game/cars";
import { findNeighborStreets } from "../geo/neighbors";
import { digestOf, streetNews } from "../game/world";
import type { Building, Car, LitterItem, LitterKind, NeighborEvent, Neighborhood, Player, Street, StreetLocation } from "../model/types";
import { LocalRepository } from "../repository/LocalRepository";
import { ApiRepository } from "../repository/ApiRepository";
import type { Account, Repository } from "../repository/Repository";

type Status = "loading" | "ready" | "error";

/** Unter einer Minute Abwesenheit gibt es keine „Während du weg warst“-Meldung. */
const OFFLINE_NOTICE_MIN_MS = 60_000;
/** So viele Neuigkeiten bleiben stehen (wie bei den Bots). */
const NEWS_LIMIT = BOTS.newsLimit;

interface GameState {
  status: Status;
  player: Player | null;
  street: Street | null;
  /** Was seit dem letzten Besuch passiert ist (Miete, Kosten, Umzüge) – wird einmal beim Start angezeigt. */
  offlineReport: OfflineReport | null;
  /** Bot-Nachbarn; null, solange sie noch „einziehen“ (Nachbarstraßen werden gesucht). */
  neighborhood: Neighborhood | null;
  neighborStreets: Record<string, Street>;
  /** Straßen anderer echter Spieler (mit Server): die mit eigenen Grundstücken und die gerade angesehenen. */
  playerStreets: Record<string, Street>;
  /** Namen der Besitzer dieser Straßen. */
  ownerNames: Record<string, string>;
  /** Straßen-IDs anderer Spieler im eigenen Ort; null = noch nicht geladen. */
  cityStreetIds: string[] | null;
  /** Server-Konto; null = ohne Server (nur dieses Gerät). */
  account: Account | null;

  /** Lädt den Spielstand aus dem Repository und verbucht die Offline-Miete (einmal beim App-Start). */
  init(): Promise<void>;
  /** Neuer Spieler claimt seine Straße. */
  claim(input: ClaimInput): Promise<void>;
  /** Verbucht laufende Miete bis jetzt. */
  tick(): Promise<void>;
  /** Überträgt die angesammelte Miete auf das Konto. */
  collect(): Promise<number>;
  /** Kauft ein Grundstück – in der eigenen Straße oder (mit `streetId`) bei einem Nachbarn. */
  buyPlot(plotId: string, streetId?: string): Promise<BuyOutcome>;
  upgrade(plotId: string, streetId?: string): Promise<UpgradeResult>;
  /** Neuigkeiten aus der Nachbarschaft als gelesen markieren. */
  markNewsSeen(): Promise<void>;
  renameBuilding(plotId: string, name: string, streetId?: string): Promise<boolean>;
  /** Einmal auf Müll/Hundehaufen tippen; beim Wegräumen gibt es ein paar Münzen. */
  cleanLitter(litterId: string): Promise<CleanResult>;
  /** Live-Dreck von Hund oder Passant auf dem Bildschirm. */
  dropLitter(kind: LitterKind, spot: Pick<LitterItem, "pos" | "side">): Promise<void>;
  buildPlayground(plotId: string): Promise<AmenityResult>;
  /** Stellt ein Gebäude auf ein eigenes Grundstück (auch in einer Nachbarstraße). */
  build(plotId: string, building: Building, streetId?: string): Promise<boolean>;
  /** Auto im Autohaus kaufen. */
  buyCar(input: { modelId: string; color: string; name: string; plate: string }): Promise<BuyCarResult>;
  /** Name, Nummernschild oder Farbe eines eigenen Autos ändern. */
  updateCar(carId: string, changes: Partial<Pick<Car, "name" | "plate" | "color">>): Promise<boolean>;
  /** Baustein gegen Münzen freischalten. */
  unlockPart(partId: string): Promise<UnlockResult>;
  /** Ungeprüfte Straße mit einer echten Straße aus der Kartensuche bestätigen. */
  verifyStreet(location: StreetLocation): Promise<boolean>;
  dismissOfflineReport(): void;
  /** Frischen Stand vom Server holen: eigene Straße (fremde Käufe) und angesehene Spieler-Straßen. */
  refresh(): Promise<void>;
  /** Eine Straße (z. B. die gerade angesehene eines Mitspielers) frisch vom Server holen. */
  refreshStreet(streetId: string): Promise<void>;
  /** Straße eines anderen Spielers laden (zum Ansehen). */
  loadPlayerStreet(streetId: string): Promise<boolean>;
  /** Andere Spieler im eigenen Ort suchen. */
  loadCity(): Promise<void>;
  /** Mit Wiederherstellungs-Code weiterspielen. */
  recover(code: string): Promise<boolean>;
  /** Spielstand komplett löschen (Debug / Neustart). */
  reset(): Promise<void>;
}

export interface OfflineReport {
  income: number;
  upkeep: number;
  movedIn: number;
  movedOut: number;
}

/** Kauf kann online zu spät sein: ein anderer Spieler war schneller (Geld kommt zurück). */
export type BuyOutcome = (BuyResult | { ok: false; reason: "taken" }) & { greeting?: string };

export interface StoreDeps {
  /** Sucht echte Nachbarstraßen; austauschbar für Tests. */
  findNeighbors?: (street: Street) => Promise<StreetLocation[]>;
}

const defaultFindNeighbors = (street: Street) =>
  street.osm ? findNeighborStreets(street.osm, street.name) : Promise.resolve([]);

export function createGameStore(repo: Repository, clock: () => number = Date.now, deps: StoreDeps = {}) {
  const findNeighbors = deps.findNeighbors ?? defaultFindNeighbors;

  return create<GameState>()((set, get) => {
    /**
     * Speichert Spieler und Straße. Online kommt die Straße zusammengeführt zurück
     * (andere Spieler können dort gekauft haben) – dann gilt dieser Stand.
     */
    async function save(player: Player, street?: Street): Promise<Street | undefined> {
      const merged = street ? await repo.saveStreet(street) : undefined;
      await repo.savePlayer(player);
      if (merged) set(streetPatch(merged));
      return merged ?? street;
    }

    /** Eigene Straße + alle Nachbarstraßen (in denen der Spieler Grundstücke haben kann). */
    function allStreets(): Street[] {
      const { street, neighborStreets, playerStreets } = get();
      return street ? [street, ...Object.values(neighborStreets), ...Object.values(playerStreets)] : [];
    }

    /** Straße nach ID; ohne ID die eigene. */
    function streetById(streetId?: string): Street | null {
      const { street, neighborStreets, playerStreets } = get();
      if (!street) return null;
      return !streetId || streetId === street.id ? street : (neighborStreets[streetId] ?? playerStreets[streetId] ?? null);
    }

    /** Zustands-Update für eine geänderte Straße – eigene, Bot- oder Spieler-Straße. */
    function streetPatch(changed: Street): Partial<GameState> {
      const { street, neighborStreets, playerStreets } = get();
      if (changed.id === street?.id) return { street: changed };
      if (playerStreets[changed.id]) return { playerStreets: { ...playerStreets, [changed.id]: changed } };
      return { neighborStreets: { ...neighborStreets, [changed.id]: changed } };
    }

    const account = () => repo.online?.account() ?? null;

    /**
     * Zeit bis jetzt vergehen lassen: Miete in die Kasse, Kosten vom Konto, Bewohner ziehen ein oder aus,
     * Müll entsteht. Übernimmt alles in den Zustand – vor jeder Aktion, die Münzen oder Einnahmen verändert.
     */
    function accrued() {
      const { player, street } = get();
      if (!player || !street) return null;
      const before = allStreets();
      const sim = simulate(player, before, clock());
      const changed = sim.streets.filter((s, i) => s !== before[i]);
      set({ player: sim.player, ...changed.reduce<Partial<GameState>>((patch, s) => ({ ...patch, ...streetPatchOn(patch, s) }), {}) });
      return { player: sim.player, street: get().street!, sim };
    }

    /** Wie `streetPatch`, aber auf einen noch nicht gesetzten Zwischenstand (mehrere Straßen auf einmal). */
    function streetPatchOn(patch: Partial<GameState>, changed: Street): Partial<GameState> {
      const state = { ...get(), ...patch };
      if (changed.id === state.street?.id) return { street: changed };
      if (state.playerStreets[changed.id]) return { playerStreets: { ...state.playerStreets, [changed.id]: changed } };
      return { neighborStreets: { ...state.neighborStreets, [changed.id]: changed } };
    }

    /** Was man von einer Straße sieht: Müll und Bewohner (gerundet). Ändert es sich, wird gespeichert. */
    const lastSaved = new Map<string, string>();
    function visibleState(street: Street): string {
      const people = street.plots.map((p) => (p.building?.occupancy === undefined ? "-" : Math.round(p.building.occupancy * 100)));
      return `${street.litter?.length ?? 0}|${people.join(",")}`;
    }
    async function saveIfVisiblyChanged(streets: Street[]) {
      for (const street of streets) {
        const state = visibleState(street);
        if (lastSaved.get(street.id) === state) continue;
        lastSaved.set(street.id, state);
        const merged = await repo.saveStreet(street);
        if (merged) set(streetPatch(merged));
      }
    }

    /** Miete verbuchen und prüfen, dass das Grundstück dem Spieler gehört. */
    function ownedPlot(plotId: string, streetId?: string) {
      const result = accrued();
      const target = streetById(streetId);
      const plot = target?.plots.find((p) => p.id === plotId);
      if (!result || !target || !plot || !belongsTo(target, plot, result.player.id)) return null;
      return { ...result, target, plot };
    }

    /**
     * Neuigkeiten aus dem, was andere Spieler in diesen Straßen getan haben (eigene Straße und Straßen von
     * Mitspielern) – und den Stand für das nächste Mal merken.
     */
    async function recordNews(streets: Street[]) {
      const { neighborhood, player } = get();
      if (!neighborhood || !player || !repo.online) return;
      const names = repo.online.playerNames();
      const known = { ...(neighborhood.known ?? {}) };
      const events: NeighborEvent[] = [];
      let changed = false;
      for (const street of streets) {
        const digest = digestOf(street);
        events.push(...streetNews(known[street.id], street, { me: player.id, names, at: clock() }));
        if (JSON.stringify(known[street.id]) !== JSON.stringify(digest)) {
          known[street.id] = digest;
          changed = true;
        }
      }
      if (!changed) return;
      const current = get().neighborhood ?? neighborhood;
      const updated = { ...current, known, news: [...events, ...current.news].slice(0, NEWS_LIMIT) };
      set({ neighborhood: updated });
      await repo.saveNeighborhood(updated);
    }

    async function saveNeighborhood(neighborhood: Neighborhood, streets: Street[]) {
      for (const street of streets) await repo.saveStreet(street);
      await repo.saveNeighborhood(neighborhood);
    }

    /** Bots ziehen ein: echte Nachbarstraßen suchen (falls möglich), Straßen anlegen, speichern. */
    async function setupNeighborhood(playerStreet: Street) {
      const neighbors = await findNeighbors(playerStreet).catch(() => []);
      if (get().street?.id !== playerStreet.id) return; // inzwischen zurückgesetzt
      const created = createNeighborhood(playerStreet, neighbors, clock());
      const { streets } = created;
      // Eigene Straße festhalten: kauft später ein Mitspieler hier ein, wird das eine Neuigkeit.
      const neighborhood = { ...created.neighborhood, known: { [playerStreet.id]: digestOf(playerStreet) } };
      await saveNeighborhood(neighborhood, streets);
      set({ neighborhood, neighborStreets: Object.fromEntries(streets.map((s) => [s.id, s])) });
    }

    return {
      status: "loading",
      player: null,
      street: null,
      offlineReport: null,
      neighborhood: null,
      neighborStreets: {},
      playerStreets: {},
      ownerNames: {},
      cityStreetIds: null,
      account: null,

      async init() {
        try {
          const loadedPlayer = await repo.loadPlayer();
          const loadedStreet = loadedPlayer ? await repo.loadStreet(loadedPlayer.streetId) : null;
          // Ein Spieler ohne Straße ist kein gültiger Spielstand.
          if (!loadedPlayer || !loadedStreet) {
            set({ status: "ready", player: null, street: null, account: account() });
            return;
          }
          const migrated = migrateSave(loadedPlayer, loadedStreet, clock());

          // Nachbarschaft laden – der Spieler kann dort Grundstücke haben, die Miete bringen.
          const storedHood = await repo.loadNeighborhood();
          const hood = storedHood?.playerStreetId === migrated.street.id ? storedHood : null;
          const hoodStreets = hood
            ? (await Promise.all(hood.bots.map((b) => repo.loadStreet(b.streetId)))).filter((s): s is Street => s !== null)
            : [];

          // Straßen anderer Spieler, in denen man Grundstücke hat – auch dort läuft Miete.
          const foreign = (await repo.online?.foreignStreets()) ?? [];
          const playerStreets = Object.fromEntries(foreign.map((f) => [f.street.id, f.street]));
          const ownerNames = Object.fromEntries(foreign.map((f) => [f.street.id, f.ownerName]));
          set({ playerStreets, ownerNames, account: account() });

          // Was ist passiert, während niemand zugeschaut hat? Stunde für Stunde: Müll, Umzüge, Miete, Kosten.
          const away = clock() - migrated.player.lastSeen;
          const before = [migrated.street, ...hoodStreets, ...foreign.map((f) => f.street)];
          const sim = simulate(migrated.player, before, clock());
          const { player } = sim;
          const [street, ...others] = sim.streets;
          hoodStreets.splice(0, hoodStreets.length, ...others.slice(0, hoodStreets.length));
          const foreignNow = others.slice(hoodStreets.length);
          set({ playerStreets: Object.fromEntries(foreignNow.map((s) => [s.id, s])) });
          await save(player, street);
          for (const changed of foreignNow.filter((s, i) => s !== foreign[i].street)) await repo.saveStreet(changed);
          for (const s of sim.streets) lastSaved.set(s.id, visibleState(s));
          const report = { income: sim.income, upkeep: sim.upkeep, movedIn: sim.movedIn, movedOut: sim.movedOut };
          const offlineReport = away >= OFFLINE_NOTICE_MIN_MS && (report.income >= 1 || report.upkeep >= 1) ? report : null;

          if (hood) {
            // Was haben die Bots seit dem letzten Besuch getan?
            const simulated = simulateNeighborhood(hood, hoodStreets, clock());
            await saveNeighborhood(simulated.neighborhood, simulated.streets);
            set({
              status: "ready",
              player,
              street,
              offlineReport,
              neighborhood: simulated.neighborhood,
              neighborStreets: Object.fromEntries(simulated.streets.map((s) => [s.id, s])),
            });
            // Was haben echte Mitspieler inzwischen getan – in meiner Straße und in ihren?
            await recordNews([street, ...foreignNow]);
            if (repo.online) void get().loadCity();
          } else {
            set({ status: "ready", player, street, offlineReport });
            void setupNeighborhood(street);
          }
        } catch (error) {
          console.error("Spielstand konnte nicht geladen werden", error);
          set({ status: "error" });
        }
      },

      async claim(input) {
        const { player, street } = claimStreet(input, clock());
        // Online zuerst anmelden – wirft StreetTakenError, wenn die echte Straße schon jemandem gehört.
        await repo.online?.register(player, street);
        await save(player, street);
        set({
          player,
          street,
          offlineReport: null,
          neighborhood: null,
          neighborStreets: {},
          playerStreets: {},
          ownerNames: {},
          cityStreetIds: null,
          account: account(),
        });
        void setupNeighborhood(street);
      },

      async tick() {
        const result = accrued();
        if (!result) return;
        await repo.savePlayer(result.player);
        // Straßen nur speichern, wenn man etwas sieht (Bewohner, Müll) – nicht jede Sekunde.
        await saveIfVisiblyChanged(allStreets());
      },

      async collect() {
        const result = accrued();
        if (!result) return 0;
        const { player, collected } = collectRent(result.player);
        set({ player, offlineReport: null });
        await repo.savePlayer(player);
        return collected;
      },

      async buyPlot(plotId, streetId) {
        const result = accrued();
        const target = streetById(streetId);
        const plot = target?.plots.find((p) => p.id === plotId);
        if (!result || !target || !plot) return { ok: false, reason: "not-found" };
        const price = currentPrice(allStreets(), target, plot, result.player.id);
        const bought = buyPlot(result.player, target, plotId, clock(), price);
        if (!bought.ok) return bought;

        set({ player: bought.player, ...streetPatch(bought.street) });
        const saved = await save(bought.player, bought.street);

        // Online war jemand schneller → Geld zurück.
        const savedPlot = saved?.plots.find((p) => p.id === plotId);
        if (saved && savedPlot && !belongsTo(saved, savedPlot, bought.player.id)) {
          const current = get().player!;
          const refunded = { ...current, coins: current.coins + price };
          set({ player: refunded });
          await repo.savePlayer(refunded);
          return { ok: false, reason: "taken" };
        }

        // Beim Nachbarn eingekauft → der Bot sagt etwas dazu (steht auch in den Neuigkeiten).
        const neighborhood = get().neighborhood;
        const bot = neighborhood?.bots.find((b) => b.streetId === target.id);
        const greeting = bot && personaOf(bot.character)?.greeting;
        if (neighborhood && bot && greeting) {
          const event = { botId: bot.id, streetId: target.id, at: clock(), text: `${bot.name}: „${greeting}“` };
          const updated = { ...neighborhood, news: [event, ...neighborhood.news].slice(0, NEWS_LIMIT), newsSeenAt: clock() };
          set({ neighborhood: updated });
          await repo.saveNeighborhood(updated);
          return { ...bought, greeting: `${bot.avatar} ${bot.name}: „${greeting}“` };
        }
        return bought;
      },

      async upgrade(plotId, streetId) {
        const owned = ownedPlot(plotId, streetId);
        if (!owned) return { ok: false, reason: "not-found" };
        const upgraded = upgradePlot(owned.player, owned.target, plotId);
        if (upgraded.ok) {
          set({ player: upgraded.player, ...streetPatch(upgraded.street) });
          await save(upgraded.player, upgraded.street);
        }
        return upgraded;
      },

      async cleanLitter(litterId) {
        // Miete bis jetzt mit dem alten Dreck-Stand verbuchen, danach zählt der neue.
        const result = accrued();
        if (!result) return null;
        const cleaned = tapLitter(result.street, litterId);
        if (!cleaned) return null;
        const player = { ...result.player, coins: result.player.coins + cleaned.reward };
        set({ player, street: cleaned.street });
        await save(player, cleaned.street);
        return cleaned;
      },

      async dropLitter(kind, spot) {
        const result = accrued();
        if (!result) return;
        const street = addLitter(result.street, kind, spot);
        if (street === result.street) return;
        set({ player: result.player, street });
        await save(result.player, street);
      },

      async buildPlayground(plotId) {
        const owned = ownedPlot(plotId);
        if (!owned) return { ok: false, reason: "not-allowed" };
        const built = buildPlayground(owned.player, owned.street, plotId);
        if (built.ok) {
          set({ player: built.player, street: built.street });
          await save(built.player, built.street);
        }
        return built;
      },

      async renameBuilding(plotId, name, streetId) {
        const target = streetById(streetId);
        const plot = target?.plots.find((p) => p.id === plotId);
        const player = get().player;
        if (!target || !plot || !player || !belongsTo(target, plot, player.id)) return false;
        const renamed = renameBuilding(target, plotId, name);
        if (!renamed) return false;
        set(streetPatch(renamed));
        await repo.saveStreet(renamed);
        return true;
      },

      async markNewsSeen() {
        const neighborhood = get().neighborhood;
        if (!neighborhood) return;
        const updated = { ...neighborhood, newsSeenAt: clock() };
        set({ neighborhood: updated });
        await repo.saveNeighborhood(updated);
      },

      async build(plotId, building, streetId) {
        // Miete bis jetzt mit dem alten Gebäude verbuchen, danach gilt die neue Miete.
        const owned = ownedPlot(plotId, streetId);
        if (!owned) return false;
        const street = placeBuilding(owned.target, plotId, building);
        if (!street) return false;
        set({ player: owned.player, ...streetPatch(street) });
        await save(owned.player, street);
        return true;
      },

      async buyCar(input) {
        const result = accrued();
        if (!result) return { ok: false, reason: "unknown-model" };
        const bought = buyCar(result.player, input, clock());
        set({ player: bought.ok ? bought.player : result.player });
        await save(bought.ok ? bought.player : result.player);
        return bought;
      },

      async updateCar(carId, changes) {
        const player = get().player;
        const updated = player && updateCar(player, carId, changes);
        if (!updated) return false;
        set({ player: updated });
        await save(updated);
        return true;
      },

      async unlockPart(partId) {
        const result = accrued();
        if (!result) return { ok: false, reason: "unknown" };
        const unlocked = unlockPart(result.player, partId);
        const player = unlocked.ok ? unlocked.player : result.player;
        set({ player });
        await save(player);
        return unlocked;
      },

      async verifyStreet(location) {
        const current = get().street;
        const street = current && verifyStreet(current, location);
        if (!street) return false;
        set({ street });
        await repo.saveStreet(street);
        return true;
      },

      dismissOfflineReport() {
        set({ offlineReport: null });
      },

      async refresh() {
        const online = repo.online;
        const { street, playerStreets } = get();
        if (!online || !street) return;
        try {
          const own = await online.fetchStreet(street.id);
          // Miete bis jetzt mit dem alten Stand verbuchen, dann den neuen übernehmen.
          if (own && get().street) {
            accrued();
            set(streetPatch(own.street));
          }
          // Mitspieler im Ort (eine Anfrage) und fremde Straßen mit eigenen Grundstücken außerhalb davon.
          await get().loadCity();
          const inCity = new Set(get().cityStreetIds ?? []);
          for (const id of Object.keys(playerStreets).filter((id) => !inCity.has(id))) {
            const entry = await online.fetchStreet(id);
            if (!entry || !get().street) continue;
            accrued();
            set(streetPatch(entry.street));
          }
          await recordNews([get().street!, ...Object.values(get().playerStreets)]);
        } catch (error) {
          console.warn("Aktualisieren fehlgeschlagen", error);
        }
        set({ account: account() });
      },

      async refreshStreet(streetId) {
        const entry = await repo.online?.fetchStreet(streetId).catch(() => null);
        if (!entry || !streetById(streetId)) return;
        accrued();
        set(streetPatch(entry.street));
        await recordNews([entry.street]);
      },

      async loadPlayerStreet(streetId) {
        if (streetById(streetId)) return true;
        const entry = await repo.online?.fetchStreet(streetId).catch(() => null);
        if (!entry || entry.ownerName === null) return false;
        set({
          playerStreets: { ...get().playerStreets, [streetId]: entry.street },
          ownerNames: { ...get().ownerNames, [streetId]: entry.ownerName },
        });
        return true;
      },

      async loadCity() {
        const { street } = get();
        if (!repo.online || !street) return;
        try {
          const found = await repo.online.cityStreets(street.city);
          const { playerStreets, ownerNames } = get();
          set({
            cityStreetIds: found.map((f) => f.street.id),
            playerStreets: { ...playerStreets, ...Object.fromEntries(found.map((f) => [f.street.id, f.street])) },
            ownerNames: { ...ownerNames, ...Object.fromEntries(found.map((f) => [f.street.id, f.ownerName])) },
          });
          await recordNews(found.map((f) => f.street));
        } catch (error) {
          console.warn("Mitspieler konnten nicht geladen werden", error);
          set({ cityStreetIds: get().cityStreetIds ?? [] });
        }
      },

      async recover(code) {
        if (!repo.online || !(await repo.online.recover(code))) return false;
        set({ status: "loading", neighborhood: null, neighborStreets: {}, playerStreets: {}, ownerNames: {}, cityStreetIds: null });
        await get().init();
        return true;
      },

      async reset() {
        await repo.reset();
        set({
          player: null,
          street: null,
          offlineReport: null,
          neighborhood: null,
          neighborStreets: {},
          playerStreets: {},
          ownerNames: {},
          cityStreetIds: null,
          account: account(),
        });
      },
    };
  });
}

/** Mit VITE_API_URL (z. B. https://babo.example.de) speichert das Spiel beim Server, sonst nur auf dem Gerät. */
function defaultRepository(): Repository {
  const local = new LocalRepository();
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl || import.meta.env.MODE === "artifact") return local;
  return new ApiRepository(apiUrl, local, local.storage);
}

export const useGameStore = createGameStore(defaultRepository());
