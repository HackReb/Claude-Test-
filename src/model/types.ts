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
  /** Wachschutz-Stufe (1 = Nachbarschaftswache, 2 = Wachdienst mit Kameras). */
  security?: 1 | 2;
  /** Was Bad Boys hier zuletzt angestellt haben (neueste zuerst). */
  incidents?: Incident[];
}

/** Ein Bad Boy ist unterwegs in eine Straße (vom Server oder von einem Bot). */
export interface Mischief {
  id: string;
  badBoyId: string;
  at: number;
  /** Vom Wachschutz abgefangen (dann steht fest, wer ihn geschickt hat). */
  blocked: boolean;
  senderName?: string;
  /** Anzeigename bei Tieren und Autos, z. B. „Maxims Elefant Benjamin“. */
  label?: string;
}

/** Was in einer Straße passiert ist. */
export interface Incident {
  id: string;
  at: number;
  badBoyId: string;
  blocked: boolean;
  text: string;
  senderName?: string;
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
  /**
   * Belegung 0–1: Anteil der Plätze mit Bewohnern (Wohnhaus) bzw. Kunden (Laden).
   * Fehlt bei älteren Ständen und Bot-Häusern – dann gilt, was die Straße gerade hergibt.
   */
  occupancy?: number;
  /** Von einem Bad Boy besprüht (der Spruch). */
  graffiti?: string;
  /** Kaputt gemacht (Fenster eingeworfen) – muss repariert werden. */
  damaged?: boolean;
  /** Ruß von Abgasen fremder Autos (Stufen). */
  soot?: number;
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
  /** Typisch für Wohnhaus oder Gewerbe – Würfeln nimmt nur passende Teile; ohne Angabe passt es zu beidem. */
  use?: BuildingUse;
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
  /** Eigene Autos, die auf der Straße fahren. */
  cars?: Car[];
  /** Eigene Tiere – sie gehen in der Nachbarschaft spazieren. */
  pets?: Pet[];
  /** Version der Spielregeln, nach denen der Stand gerechnet wird (2 = Bewohner & laufende Kosten). */
  economy?: number;
  /** UFO-Besuche: wann zuletzt und wann das nächste Mal. Fehlt = noch nie gesehen (kommt bald). */
  aliens?: { lastAt: number; nextAt: number };
}

export interface Car {
  id: string;
  modelId: string;
  color: string;
  /** z. B. „Kalles Borsche“ */
  name: string;
  /** Nummernschild, z. B. „TUT-KA 911“ */
  plate: string;
  boughtAt: number;
  /** Wann das Auto das nächste Mal durch eine Nachbarstraße fährt. */
  nextOutingAt?: number;
}

export interface Pet {
  id: string;
  speciesId: string;
  /** z. B. „Benjamin“ */
  name: string;
  boughtAt: number;
  /** Wann das Tier das nächste Mal in der Nachbarschaft spazieren geht. */
  nextOutingAt?: number;
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
  /** Wann der Bot das nächste Mal einen Bad Boy zum Spieler schickt. */
  nextMischiefAt?: number;
}

export interface NeighborEvent {
  /** Bot, der etwas getan hat – fehlt bei echten Mitspielern. */
  botId?: string;
  /** Echter Mitspieler, der etwas getan hat. */
  playerName?: string;
  /** Bild zur Meldung (z. B. der Bad Boy). */
  emoji?: string;
  streetId: string;
  at: number;
  text: string;
}

/** Was man zuletzt von einer Straße eines Mitspielers gesehen hat – daraus entstehen Neuigkeiten. */
export interface StreetDigest {
  /** Grundstück → Besitzer, Gebäudename, Stufe, Spielplatz. */
  plots: Record<string, { owner?: string; name?: string; level?: number; amenity?: string }>;
}

export interface Neighborhood {
  playerStreetId: string;
  bots: Bot[];
  /** Richtung jeder Bot-Straße auf der Karte in Grad (0 = Osten, 90 = Norden). */
  bearings: Record<string, number>;
  news: NeighborEvent[];
  /** Bis wann der Spieler die Neuigkeiten gesehen hat. */
  newsSeenAt: number;
  /** Zuletzt gesehener Stand der Straßen echter Mitspieler (und der eigenen), um Änderungen zu melden. */
  known?: Record<string, StreetDigest>;
  /** Die Tageszeitung. */
  paper?: Paper;
}

// ---------- Tageszeitung ----------

export interface PaperStats {
  residents: number;
  places: number;
  income: number;
  litter: number;
  poop: number;
  graffiti: number;
  damaged: number;
  homes: number;
  playgrounds: number;
}

export interface PaperStory {
  id: string;
  streetId: string;
  headline: string;
  text: string;
  tone: "good" | "bad" | "funny";
  score: number;
}

export interface PaperIssue {
  /** Kalendertag (JJJJ-MM-TT). */
  day: string;
  at: number;
  stories: PaperStory[];
}

export interface Paper {
  issue: PaperIssue;
  /** Kennzahlen der Straßen zum Zeitpunkt dieser Ausgabe – Vergleich für die nächste. */
  stats: Record<string, PaperStats>;
  /** Gelesen? */
  read: boolean;
}
