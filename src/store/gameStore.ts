import { create } from "zustand";
import { claimStreet, verifyStreet, type ClaimInput } from "../game/claimStreet";
import { migrateSave } from "../game/migrate";
import { buyPlot, placeBuilding, type BuyResult } from "../game/plots";
import { accrueRent, collectRent } from "../game/rent";
import { unlockPart, type UnlockResult } from "../game/unlock";
import type { Building, Player, Street, StreetLocation } from "../model/types";
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

  /** Lädt den Spielstand aus dem Repository und verbucht die Offline-Miete (einmal beim App-Start). */
  init(): Promise<void>;
  /** Neuer Spieler claimt seine Straße. */
  claim(input: ClaimInput): Promise<void>;
  /** Verbucht laufende Miete bis jetzt. */
  tick(): Promise<void>;
  /** Überträgt die angesammelte Miete auf das Konto. */
  collect(): Promise<number>;
  buyPlot(plotId: string): Promise<BuyResult>;
  /** Stellt ein Gebäude auf ein eigenes Grundstück. */
  build(plotId: string, building: Building): Promise<boolean>;
  /** Baustein gegen Münzen freischalten. */
  unlockPart(partId: string): Promise<UnlockResult>;
  /** Ungeprüfte Straße mit einer echten Straße aus der Kartensuche bestätigen. */
  verifyStreet(location: StreetLocation): Promise<boolean>;
  dismissOfflineEarnings(): void;
  /** Spielstand komplett löschen (Debug / Neustart). */
  reset(): Promise<void>;
}

export function createGameStore(repo: Repository, clock: () => number = Date.now) {
  return create<GameState>()((set, get) => {
    async function save(player: Player, street?: Street) {
      if (street) await repo.saveStreet(street);
      await repo.savePlayer(player);
    }

    /** Miete bis jetzt verbuchen – vor jeder Aktion, die Münzen oder Einnahmen verändert. */
    function accrued() {
      const { player, street } = get();
      if (!player || !street) return null;
      return { ...accrueRent(player, street, clock()), street };
    }

    return {
      status: "loading",
      player: null,
      street: null,
      offlineEarnings: null,

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
          const away = clock() - migrated.player.lastSeen;
          const { player, gained } = accrueRent(migrated.player, migrated.street, clock());
          await save(player, migrated.street);
          set({
            status: "ready",
            player,
            street: migrated.street,
            offlineEarnings: away >= OFFLINE_NOTICE_MIN_MS && gained >= 1 ? gained : null,
          });
        } catch (error) {
          console.error("Spielstand konnte nicht geladen werden", error);
          set({ status: "error" });
        }
      },

      async claim(input) {
        const { player, street } = claimStreet(input, clock());
        await save(player, street);
        set({ player, street, offlineEarnings: null });
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

      async buyPlot(plotId) {
        const result = accrued();
        if (!result) return { ok: false, reason: "not-found" };
        const bought = buyPlot(result.player, result.street, plotId, clock());
        if (bought.ok) {
          set({ player: bought.player, street: bought.street });
          await save(bought.player, bought.street);
        }
        return bought;
      },

      async build(plotId, building) {
        // Miete bis jetzt mit dem alten Gebäude verbuchen, danach gilt die neue Miete.
        const result = accrued();
        if (!result) return false;
        const street = placeBuilding(result.street, plotId, building);
        if (!street) return false;
        set({ player: result.player, street });
        await save(result.player, street);
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
        set({ player: null, street: null, offlineEarnings: null });
      },
    };
  });
}

export const useGameStore = createGameStore(new LocalRepository());
