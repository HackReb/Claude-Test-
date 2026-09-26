import { describe, expect, it } from "vitest";
import { claimStreet } from "../game/claimStreet";
import { LocalRepository, type KeyValueStorage } from "./LocalRepository";

function memoryStorage(): KeyValueStorage & { size: () => number } {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    size: () => data.size,
  };
}

describe("LocalRepository", () => {
  it("speichert und lädt Spieler und Straße", async () => {
    const storage = memoryStorage();
    const repo = new LocalRepository(storage);
    const { player, street } = claimStreet({ playerName: "Kalle", streetName: "Weg", city: "Ulm" }, 1);

    expect(await repo.loadPlayer()).toBeNull();
    await repo.saveStreet(street);
    await repo.savePlayer(player);

    const fresh = new LocalRepository(storage);
    expect(await fresh.loadPlayer()).toEqual(player);
    expect(await fresh.loadStreet(street.id)).toEqual(street);
    expect(await fresh.listStreets()).toEqual([street]);
  });

  it("indexiert Straßen nicht doppelt und reset löscht alles", async () => {
    const storage = memoryStorage();
    const repo = new LocalRepository(storage);
    const { player, street } = claimStreet({ playerName: "Kalle", streetName: "Weg", city: "Ulm" }, 1);
    await repo.saveStreet(street);
    await repo.saveStreet(street);
    await repo.savePlayer(player);
    expect(await repo.listStreets()).toHaveLength(1);

    await repo.reset();
    expect(storage.size()).toBe(0);
    expect(await repo.loadPlayer()).toBeNull();
  });

  it("kaputte Daten führen zu null statt Absturz", async () => {
    const storage = memoryStorage();
    storage.setItem("babo:v1:player", "{kaputt");
    expect(await new LocalRepository(storage).loadPlayer()).toBeNull();
  });
});
