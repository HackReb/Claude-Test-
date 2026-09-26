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

export interface Part {
  id: string;
  category: PartCategory;
  svg: string; // Inline-SVG-Symbol
  price: number; // 0 = Start-Set
  rentBonus: number; // z. B. 0.05
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  unlockedParts: string[];
  streetId: string;
  lastSeen: number;
}
