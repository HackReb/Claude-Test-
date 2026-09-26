import type { Neighborhood, Player, Street } from "../model/types";

/**
 * Persistenz-Schicht. Heute: LocalRepository (localStorage).
 * Später: ApiRepository gegen das Symfony-Backend – deshalb ist alles async.
 */
export interface Repository {
  loadPlayer(): Promise<Player | null>;
  savePlayer(player: Player): Promise<void>;

  loadStreet(id: string): Promise<Street | null>;
  saveStreet(street: Street): Promise<void>;
  listStreets(): Promise<Street[]>;

  loadNeighborhood(): Promise<Neighborhood | null>;
  saveNeighborhood(neighborhood: Neighborhood): Promise<void>;

  /** Löscht alle gespeicherten Spieldaten. */
  reset(): Promise<void>;
}
