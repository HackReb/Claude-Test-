// Datenmodell (MVP) – siehe KONZEPT-Strassen-Game.md, Abschnitt 9.

export type PlotSize = "S" | "M" | "L";

export interface Street {
  id: string;
  name: string; // z. B. "Bahnhofstraße"
  city: string; // z. B. "Tuttlingen"
  /** Verweis auf die echte Straße in OpenStreetMap; fehlt bei manuell eingegebenen (ungeprüften) Straßen. */
  osm?: OsmStreetRef;
  ownerId: string; // Spieler oder Bot
  plots: Plot[];
  /** Müll und Hundehaufen auf den Gehwegen. */
  litter?: LitterItem[];
  /** Bis wann Müll „nachgewürfelt“ wurde (für die Zeit, in der niemand zugeschaut hat). */
  litterCheckedAt?: number;
}

export type LitterKind = "trash" | "poop";

export interface LitterItem {
  id: string;
  kind: LitterKind;
  /** Position entlang der Straße, 0 = links, 1 = rechts. */
  pos: number;
  /** Gehweg oben (vor der linken Straßenseite) oder unten. */
  side: "top" | "bottom";
  /** Wie oft schon getippt wurde (Hundehaufen brauchen mehrere Tipper). */
  taps: number;
}

/** Echte Straße aus OpenStreetMap. */
export interface OsmStreetRef {
  /**
   * Stabile Kennung der Straße (Land + PLZ + Ort + Name, normalisiert). Nicht die Weg-ID:
   * in OSM besteht eine Straße meist aus vielen einzelnen Wegen.
   */
  key: string;
  /** Ein OSM-Weg dieser Straße, z. B. "W123456" – für eine spätere Kartenansicht. */
  wayId: string;
  lat: number;
  lon: number;
  postcode?: string;
  district?: string;
  countryCode?: string;
}

/** Straße, wie sie beim Claimen gewählt oder eingetippt wurde. */
export interface StreetLocation {
  name: string;
  city: string;
  osm?: OsmStreetRef;
}

export interface Plot {
  id: string;
  size: PlotSize;
  side: "left" | "right";
  index: number;
  price: number;
  building?: Building;
  purchasedAt?: number;
  /** Start-Geschenk – zählt nicht als Kauf für den Preisanstieg. */
  gifted?: boolean;
  /**
   * Käufer, wenn es nicht der Besitzer der Straße ist (z. B. dein Grundstück in Zoes Zuckerallee).
   * Fehlt → das Grundstück gehört dem Besitzer der Straße.
   */
  ownerId?: string;
  /** Anlage ohne Gebäude, z. B. ein Spielplatz. */
  amenity?: Amenity;
}

export type Amenity = "playground";

/** Nutzung eines Gebäudes: Wohnen bringt Bewohner (Kinder, Hunde), Gewerbe bringt Kundschaft (und Müll). */
export type BuildingUse = "residential" | "commercial";

export interface Building {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  facade: Facade;
  createdBy: "template" | "random" | "player";
  /** Fehlt bei älteren Spielständen – dann entscheidet `useOf()` anhand der Fassade. */
  use?: BuildingUse;
}

export interface Facade {
  base: PartRef; // Grundkörper
  roof: PartRef;
  floors: 1 | 2 | 3;
  parts: PlacedPart[]; // Türen, Fenster, Deko mit Rasterposition
}

export interface PlacedPart {
  partId: string;
  x: number;
  y: number;
  text?: string;
}

export interface PartRef {
  partId: string;
  color?: string;
}

export type PartCategory = "base" | "roof" | "door" | "window" | "deco";

/** Wo ein Teil sitzt: an der Wand (Standard), auf dem Boden vor der Wand oder auf dem Dach. */
export type PartMount = "wall" | "ground" | "roof";

export interface Part {
  id: string;
  name: string;
  category: PartCategory;
  mount?: PartMount;
  /** Textfarbe, falls das Teil eigenen Text trägt (Schild, Neonschrift). */
  textFill?: string;
  svg: string; // Inline-SVG-Symbol
  price: number; // 0 = Start-Set
  rentBonus: number; // z. B. 0.05
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  /** Angesammelte, noch nicht eingesammelte Miete (mit Nachkommastellen). */
  pendingRent: number;
  unlockedParts: string[];
  streetId: string;
  /** Zeitpunkt, bis zu dem Miete in `pendingRent` verbucht ist. */
  lastSeen: number;
}

// ---------- Nachbarschaft (Bots) ----------

export type BotCharacter = "sweet" | "concrete" | "chaos" | "nature" | "party";

export interface Bot {
  id: string;
  name: string;
  /** Emoji als Avatar. */
  avatar: string;
  character: BotCharacter;
  streetId: string;
  /** Zeitpunkt der letzten Aktion; Aktionen seit dann werden beim App-Start nachgeholt. */
  lastActionAt: number;
  /** Zähler aller Aktionen – macht das Verhalten reproduzierbar (Zufall aus Bot-ID + Zähler). */
  actions: number;
}

export interface NeighborEvent {
  botId: string;
  streetId: string;
  at: number;
  text: string;
}

export interface Neighborhood {
  playerStreetId: string;
  bots: Bot[];
  /** Richtung jeder Bot-Straße auf der Karte in Grad (0 = Osten, 90 = Norden). */
  bearings: Record<string, number>;
  news: NeighborEvent[];
  /** Bis wann der Spieler die Neuigkeiten gesehen hat. */
  newsSeenAt: number;
}
