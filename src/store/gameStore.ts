import { create } from "zustand";
import { claimStreet, type ClaimInput } from "../game/claimStreet";
import type { Player, Street } from "../model/types";
import { LocalRepository } from "../repository/LocalRepository";
import type { Repository } from "../repository/Repository";

type Status = "loading" | "ready" | "error";

interface GameState {
  status: Status;
  player: Player | null;
  street: Street | null;

  /** Lädt den Spielstand aus dem Repository (einmal beim App-Start). */
  init(): Promise<void>;
  /** Neuer Spieler claimt seine Straße. */
  claim(input: ClaimInput): Promise<void>;
  /** Spielstand komplett löschen (Debug / Neustart). */
  reset(): Promise<void>;
}

export function createGameStore(repo: Repository) {
  return create<GameState>()((set) => ({
    status: "loading",
    player: null,
    street: null,

    async init() {
      try {
        const player = await repo.loadPlayer();
        const street = player ? await repo.loadStreet(player.streetId) : null;
        // Ein Spieler ohne Straße ist kein gültiger Spielstand.
        set(player && street ? { status: "ready", player, street } : { status: "ready", player: null, street: null });
      } catch (error) {
        console.error("Spielstand konnte nicht geladen werden", error);
        set({ status: "error" });
      }
    },

    async claim(input) {
      const { player, street } = claimStreet(input, Date.now());
      await repo.saveStreet(street);
      await repo.savePlayer(player);
      set({ player, street });
    },

    async reset() {
      await repo.reset();
      set({ player: null, street: null });
    },
  }));
}

export const useGameStore = createGameStore(new LocalRepository());
