// Datenmodell (MVP) – siehe KONZEPT-Strassen-Game.md, Abschnitt 9.

export type PlotSize = "S" | "M" | "L";

export interface Street {
  id: string;
  name: string; // z. B. "Bahnhofstraße"
  city: string; // z. B. "Tuttlingen"
  ownerId: string; // Spieler oder Bot
  plots: Plot[];
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
}

export interface Building {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  facade: Facade;
  createdBy: "template" | "random" | "player";
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
