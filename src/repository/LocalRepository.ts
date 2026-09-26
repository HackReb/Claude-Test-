import type { Neighborhood, Player, Street } from "../model/types";
import type { Repository } from "./Repository";

/** Minimaler Ausschnitt der Web-Storage-API, damit Tests einen In-Memory-Storage einsetzen können. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "babo:v1:";
const PLAYER_KEY = `${PREFIX}player`;
const STREET_INDEX_KEY = `${PREFIX}streets`;
const NEIGHBORHOOD_KEY = `${PREFIX}neighborhood`;
const streetKey = (id: string) => `${PREFIX}street:${id}`;

/** In-Memory-Ersatz, falls localStorage fehlt oder gesperrt ist (privater Modus, eingebettete Frames). */
export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function defaultStorage(): KeyValueStorage {
  try {
    const storage = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    console.warn("localStorage nicht verfügbar – Spielstand wird nur im Speicher gehalten.");
    return memoryStorage();
  }
}

export class LocalRepository implements Repository {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultStorage()) {
    this.storage = storage;
  }

  async loadPlayer(): Promise<Player | null> {
    return this.read<Player>(PLAYER_KEY);
  }

  async savePlayer(player: Player): Promise<void> {
    this.write(PLAYER_KEY, player);
  }

  async loadStreet(id: string): Promise<Street | null> {
    return this.read<Street>(streetKey(id));
  }

  async saveStreet(street: Street): Promise<void> {
    this.write(streetKey(street.id), street);
    const index = this.streetIndex();
    if (!index.includes(street.id)) {
      this.write(STREET_INDEX_KEY, [...index, street.id]);
    }
  }

  async listStreets(): Promise<Street[]> {
    return this.streetIndex()
      .map((id) => this.read<Street>(streetKey(id)))
      .filter((s): s is Street => s !== null);
  }

  async loadNeighborhood(): Promise<Neighborhood | null> {
    return this.read<Neighborhood>(NEIGHBORHOOD_KEY);
  }

  async saveNeighborhood(neighborhood: Neighborhood): Promise<void> {
    this.write(NEIGHBORHOOD_KEY, neighborhood);
  }

  async reset(): Promise<void> {
    for (const id of this.streetIndex()) {
      this.storage.removeItem(streetKey(id));
    }
    this.storage.removeItem(STREET_INDEX_KEY);
    this.storage.removeItem(NEIGHBORHOOD_KEY);
    this.storage.removeItem(PLAYER_KEY);
  }

  private streetIndex(): string[] {
    return this.read<string[]>(STREET_INDEX_KEY) ?? [];
  }

  private read<T>(key: string): T | null {
    const raw = this.storage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value));
  }
}
