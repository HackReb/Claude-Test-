import type { Player, Street } from "../model/types";
import type { Repository } from "./Repository";

/** Minimaler Ausschnitt der Web-Storage-API, damit Tests einen In-Memory-Storage einsetzen können. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "babo:v1:";
const PLAYER_KEY = `${PREFIX}player`;
const STREET_INDEX_KEY = `${PREFIX}streets`;
const streetKey = (id: string) => `${PREFIX}street:${id}`;

export class LocalRepository implements Repository {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = globalThis.localStorage) {
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

  async reset(): Promise<void> {
    for (const id of this.streetIndex()) {
      this.storage.removeItem(streetKey(id));
    }
    this.storage.removeItem(STREET_INDEX_KEY);
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
