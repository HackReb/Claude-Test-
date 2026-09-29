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
  /** Mit Konto angemeldet und eine Straße gewählt. */
  | "online"
  /** Mit Konto angemeldet, aber noch keine Straße gewählt (oder gerade eine neue am Claimen). */
  | "choose"
  /** Nicht angemeldet – erst anmelden oder ein Konto anlegen. */
  | "logged-out"
  /** Älterer Spielstand ohne Konto: spielt weiter, soll aber ein Konto einrichten. */
  | "legacy"
  /** Noch nicht angemeldet (Server war nicht erreichbar) – wird beim nächsten Start nachgeholt. */
  | "pending"
  /** Die eigene echte Straße gehörte online schon jemand anderem. */
  | "street-taken"
  /** Dieses Gerät wurde abgemeldet (Code auf einem anderen Gerät benutzt). */
  | "signed-out";

export interface Account {
  status: AccountStatus;
  /** Älterer Spielstand: sein BABO-Code (damit hängt man ihn an ein Konto). */
  recoveryCode?: string;
  /** Bei „street-taken“: wem die Straße gehört. */
  takenBy?: string;
  /** Mit Konto: Name, Straßen (höchstens `maxStreets`) und die gerade gespielte. */
  name?: string;
  streets?: AccountStreet[];
  maxStreets?: number;
  activePlayerId?: string;
}

/** Eine Straße im Konto – jede ist ein eigener Spielstand. */
export interface AccountStreet {
  playerId: string;
  playerName: string;
  streetId: string;
  streetName: string;
  city: string;
}

export type AccountResult = { ok: true } | { ok: false; message: string };

/** Der Server lehnt die neue Straße ab (z. B. schon drei Straßen im Konto). */
export class ClaimRejectedError extends Error {}

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
  /**
   * Dieses Gerät abmelden: erst alles Ausstehende zum Server schicken, dann die Daten hier löschen.
   * Auf dem Server bleibt alles – mit dem Code geht es woanders weiter. `false` = Server nicht erreichbar, nichts gelöscht.
   */
  signOut(): Promise<boolean>;
  /** Mit Name + Passwort anmelden. */
  login(name: string, password: string): Promise<AccountResult>;
  /** Konto anlegen – ein älterer Spielstand auf diesem Gerät kommt mit. */
  createAccount(name: string, password: string): Promise<AccountResult>;
  /** Straßenliste des Kontos neu laden. */
  refreshAccount(): Promise<void>;
  /** Zu einer Straße des Kontos wechseln. `false` = ging nicht (Server nicht erreichbar). */
  selectStreet(playerId: string): Promise<boolean>;
  /** Aktuelle Straße weglegen, um eine neue zu claimen (das Konto bleibt angemeldet). */
  startNewStreet(): Promise<boolean>;
  /** Ältere Straße per BABO-Code ans Konto hängen. */
  attachCode(code: string): Promise<AccountResult>;
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
