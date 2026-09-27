import type { Mischief, Neighborhood, Player, Street } from "../model/types";

/**
 * Persistenz-Schicht: LocalRepository (localStorage, nur dieses Gerät) oder
 * ApiRepository (Server, mehrere Spieler teilen eine Welt) – deshalb ist alles async.
 */
export interface Repository {
  loadPlayer(): Promise<Player | null>;
  savePlayer(player: Player): Promise<void>;

  loadStreet(id: string): Promise<Street | null>;
  /**
   * Speichert eine Straße. Online kommt die zusammengeführte Straße zurück – jemand anderes
   * kann dort inzwischen ein Grundstück gekauft haben.
   */
  saveStreet(street: Street): Promise<Street | void>;
  listStreets(): Promise<Street[]>;

  loadNeighborhood(): Promise<Neighborhood | null>;
  saveNeighborhood(neighborhood: Neighborhood): Promise<void>;

  /** Löscht alle gespeicherten Spieldaten. */
  reset(): Promise<void>;

  /** Nur mit Server: echte Mitspieler. */
  online?: OnlineFeatures;
}

/** Straße eines anderen echten Spielers. */
export interface ForeignStreet {
  street: Street;
  ownerName: string;
}

export type AccountStatus =
  /** Mit dem Server verbunden. */
  | "online"
  /** Noch nicht angemeldet (Server war nicht erreichbar) – wird beim nächsten Start nachgeholt. */
  | "pending"
  /** Die eigene echte Straße gehörte online schon jemand anderem. */
  | "street-taken"
  /** Dieses Gerät wurde abgemeldet (Code auf einem anderen Gerät benutzt). */
  | "signed-out";

export interface Account {
  status: AccountStatus;
  /** Zum Weiterspielen auf einem anderen Gerät. */
  recoveryCode?: string;
  /** Bei „street-taken“: wem die Straße gehört. */
  takenBy?: string;
}

export interface OnlineFeatures {
  account(): Account;
  /** Neuen Spieler anmelden. Wirft `StreetTakenError`, wenn die echte Straße schon jemandem gehört. */
  register(player: Player, street: Street): Promise<void>;
  /** Straßen anderer Spieler, in denen man Grundstücke hat (Stand der letzten Synchronisierung). */
  foreignStreets(): Promise<ForeignStreet[]>;
  /** Straßen anderer Spieler im selben Ort. */
  cityStreets(city: string): Promise<ForeignStreet[]>;
  /** Frischen Stand einer Straße vom Server holen. */
  fetchStreet(id: string): Promise<{ street: Street; ownerName: string | null } | null>;
  /** Mit Wiederherstellungs-Code auf diesem Gerät weiterspielen. `false` = Code unbekannt. */
  recover(code: string): Promise<boolean>;
  /** Bekannte Namen echter Spieler (Spieler-ID → Name). */
  playerNames(): Record<string, string>;
  /** Bad Boys, die in der eigenen Straße angekommen sind (Stand der letzten Synchronisierung). */
  incomingMischief(): Mischief[];
  /** Posteingang frisch vom Server holen. */
  fetchMischief(): Promise<Mischief[]>;
  /** Verarbeitete Bad Boys bestätigen. */
  ackMischief(ids: string[]): Promise<void>;
  /** Einen Bad Boy (oder ein Tier/Auto auf Ausflug, mit Namen) in die Straße eines anderen Spielers schicken. */
  sendMischief(streetId: string, badBoyId: string, label?: string): Promise<{ ok: true; mischief: Mischief } | { ok: false; message: string }>;
}

export class StreetTakenError extends Error {
  constructor(readonly ownerName: string | null) {
    super(ownerName ? `Die Straße gehört schon ${ownerName}.` : "Die Straße gehört schon jemandem.");
    this.name = "StreetTakenError";
  }
}
