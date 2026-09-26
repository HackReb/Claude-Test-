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
import { personaOf } from "../config/bots";
import { addLitter, buildPlayground, spawnLitter, tapLitter, type AmenityResult, type CleanResult } from "../game/life";
import { accrueRent, collectRent } from "../game/rent";
import { unlockPart, type UnlockResult } from "../game/unlock";
import { findNeighborStreets } from "../geo/neighbors";
import type { Building, LitterItem, LitterKind, Neighborhood, Player, Street, StreetLocation } from "../model/types";
import { LocalRepository } from "../repository/LocalRepository";
import type { Repository } from "../repository/Repository";

type Status = "loading" | "ready" | "error";

/** Unter einer Minute Abwesenheit gibt es keine „Während du weg warst“-Meldung. */
const OFFLINE_NOTICE_MIN_MS = 60_000;

interface GameState {
  status: Status;
  player: Player | null;
  street: Street | null;
  /** Miete, die seit dem letzten Besuch aufgelaufen ist – wird einmal beim Start angezeigt. */
  offlineEarnings: number | null;
  /** Bot-Nachbarn; null, solange sie noch „einziehen“ (Nachbarstraßen werden gesucht). */
  neighborhood: Neighborhood | null;
  neighborStreets: Record<string, Street>;

  /** Lädt den Spielstand aus dem Repository und verbucht die Offline-Miete (einmal beim App-Start). */
  init(): Promise<void>;
  /** Neuer Spieler claimt seine Straße. */
  claim(input: ClaimInput): Promise<void>;
  /** Verbucht laufende Miete bis jetzt. */
  tick(): Promise<void>;
  /** Überträgt die angesammelte Miete auf das Konto. */
  collect(): Promise<number>;
  /** Kauft ein Grundstück – in der eigenen Straße oder (mit `streetId`) bei einem Nachbarn. */
  buyPlot(plotId: string, streetId?: string): Promise<BuyResult & { greeting?: string }>;
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
  /** Baustein gegen Münzen freischalten. */
  unlockPart(partId: string): Promise<UnlockResult>;
  /** Ungeprüfte Straße mit einer echten Straße aus der Kartensuche bestätigen. */
  verifyStreet(location: StreetLocation): Promise<boolean>;
  dismissOfflineEarnings(): void;
  /** Spielstand komplett löschen (Debug / Neustart). */
  reset(): Promise<void>;
}

export interface StoreDeps {
  /** Sucht echte Nachbarstraßen; austauschbar für Tests. */
  findNeighbors?: (street: Street) => Promise<StreetLocation[]>;
}

const defaultFindNeighbors = (street: Street) =>
  street.osm ? findNeighborStreets(street.osm, street.name) : Promise.resolve([]);

export function createGameStore(repo: Repository, clock: () => number = Date.now, deps: StoreDeps = {}) {
  const findNeighbors = deps.findNeighbors ?? defaultFindNeighbors;

  return create<GameState>()((set, get) => {
    async function save(player: Player, street?: Street) {
      if (street) await repo.saveStreet(street);
      await repo.savePlayer(player);
    }

    /** Eigene Straße + alle Nachbarstraßen (in denen der Spieler Grundstücke haben kann). */
    function allStreets(): Street[] {
      const { street, neighborStreets } = get();
      return street ? [street, ...Object.values(neighborStreets)] : [];
    }

    /** Straße nach ID; ohne ID die eigene. */
    function streetById(streetId?: string): Street | null {
      const { street, neighborStreets } = get();
      if (!street) return null;
      return !streetId || streetId === street.id ? street : (neighborStreets[streetId] ?? null);
    }

    /** Zustands-Update für eine geänderte Straße – eigene oder Nachbarstraße. */
    function streetPatch(changed: Street): Partial<GameState> {
      return changed.id === get().street?.id
        ? { street: changed }
        : { neighborStreets: { ...get().neighborStreets, [changed.id]: changed } };
    }

    /** Miete bis jetzt verbuchen – vor jeder Aktion, die Münzen oder Einnahmen verändert. */
    function accrued() {
      const { player, street } = get();
      if (!player || !street) return null;
      return { ...accrueRent(player, allStreets(), clock()), street };
    }

    /** Miete verbuchen und prüfen, dass das Grundstück dem Spieler gehört. */
    function ownedPlot(plotId: string, streetId?: string) {
      const result = accrued();
      const target = streetById(streetId);
      const plot = target?.plots.find((p) => p.id === plotId);
      if (!result || !target || !plot || !belongsTo(target, plot, result.player.id)) return null;
      return { ...result, target, plot };
    }

    async function saveNeighborhood(neighborhood: Neighborhood, streets: Street[]) {
      for (const street of streets) await repo.saveStreet(street);
      await repo.saveNeighborhood(neighborhood);
    }

    /** Bots ziehen ein: echte Nachbarstraßen suchen (falls möglich), Straßen anlegen, speichern. */
    async function setupNeighborhood(playerStreet: Street) {
      const neighbors = await findNeighbors(playerStreet).catch(() => []);
      if (get().street?.id !== playerStreet.id) return; // inzwischen zurückgesetzt
      const { neighborhood, streets } = createNeighborhood(playerStreet, neighbors, clock());
      await saveNeighborhood(neighborhood, streets);
      set({ neighborhood, neighborStreets: Object.fromEntries(streets.map((s) => [s.id, s])) });
    }

    return {
      status: "loading",
      player: null,
      street: null,
      offlineEarnings: null,
      neighborhood: null,
      neighborStreets: {},

      async init() {
        try {
          const loadedPlayer = await repo.loadPlayer();
          const loadedStreet = loadedPlayer ? await repo.loadStreet(loadedPlayer.streetId) : null;
          // Ein Spieler ohne Straße ist kein gültiger Spielstand.
          if (!loadedPlayer || !loadedStreet) {
            set({ status: "ready", player: null, street: null });
            return;
          }
          const migrated = migrateSave(loadedPlayer, loadedStreet);

          // Nachbarschaft laden – der Spieler kann dort Grundstücke haben, die Miete bringen.
          const storedHood = await repo.loadNeighborhood();
          const hood = storedHood?.playerStreetId === migrated.street.id ? storedHood : null;
          const hoodStreets = hood
            ? (await Promise.all(hood.bots.map((b) => repo.loadStreet(b.streetId)))).filter((s): s is Street => s !== null)
            : [];

          const away = clock() - migrated.player.lastSeen;
          const { player, gained } = accrueRent(migrated.player, [migrated.street, ...hoodStreets], clock());
          // Danach liegt der Müll herum, der inzwischen entstanden ist – er drückt ab jetzt die Miete.
          const street = spawnLitter(migrated.street, clock());
          await save(player, street);
          const offlineEarnings = away >= OFFLINE_NOTICE_MIN_MS && gained >= 1 ? gained : null;

          if (hood) {
            // Was haben die Bots seit dem letzten Besuch getan?
            const simulated = simulateNeighborhood(hood, hoodStreets, clock());
            await saveNeighborhood(simulated.neighborhood, simulated.streets);
            set({
              status: "ready",
              player,
              street,
              offlineEarnings,
              neighborhood: simulated.neighborhood,
              neighborStreets: Object.fromEntries(simulated.streets.map((s) => [s.id, s])),
            });
          } else {
            set({ status: "ready", player, street, offlineEarnings });
            void setupNeighborhood(street);
          }
        } catch (error) {
          console.error("Spielstand konnte nicht geladen werden", error);
          set({ status: "error" });
        }
      },

      async claim(input) {
        const { player, street } = claimStreet(input, clock());
        await save(player, street);
        set({ player, street, offlineEarnings: null, neighborhood: null, neighborStreets: {} });
        void setupNeighborhood(street);
      },

      async tick() {
        const result = accrued();
        if (!result) return;
        set({ player: result.player });
        await save(result.player);
      },

      async collect() {
        const result = accrued();
        if (!result) return 0;
        const { player, collected } = collectRent(result.player);
        set({ player, offlineEarnings: null });
        await save(player);
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
        await save(bought.player, bought.street);

        // Beim Nachbarn eingekauft → der Bot sagt etwas dazu (steht auch in den Neuigkeiten).
        const neighborhood = get().neighborhood;
        const bot = neighborhood?.bots.find((b) => b.streetId === target.id);
        const greeting = bot && personaOf(bot.character)?.greeting;
        if (neighborhood && bot && greeting) {
          const event = { botId: bot.id, streetId: target.id, at: clock(), text: `${bot.name}: „${greeting}“` };
          const updated = { ...neighborhood, news: [event, ...neighborhood.news].slice(0, 20), newsSeenAt: clock() };
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

      dismissOfflineEarnings() {
        set({ offlineEarnings: null });
      },

      async reset() {
        await repo.reset();
        set({ player: null, street: null, offlineEarnings: null, neighborhood: null, neighborStreets: {} });
      },
    };
  });
}

export const useGameStore = createGameStore(new LocalRepository());
