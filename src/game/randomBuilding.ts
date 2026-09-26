import { ECONOMY } from "../config/economy";
import type { Building, BuildingUse, Facade, Part, PlacedPart, PlotSize } from "../model/types";
import { partsOf } from "../parts/catalog";
import { facadeColumns } from "../parts/grid";
import { allowedRows, cellKey, FACADE_RULES, layerOf } from "../parts/rules";
import { createId } from "./ids";
import { shuffle } from "./random";

type Random = () => number;

const SIGN_WORDS = ["BABO", "KIOSK", "DÖNER", "LECKER", "CHILL", "WOW", "YOLO", "EIS", "SPÄTI"];
const NEON_WORDS = ["OPEN", "24/7", "BAR", "LOVE", "PARTY"];

const NAME_PREFIX: Record<string, string> = {
  "base-brick": "Backstein",
  "base-wood": "Holz",
  "base-chocolate": "Schoko",
  "base-gummy": "Gummi",
  "base-ice": "Eis",
};
const NAME_NOUN: Record<PlotSize, string[]> = {
  S: ["Bude", "Hütte", "Kiste", "Ecke"],
  M: ["Haus", "Laden", "Villa", "Treff"],
  L: ["Palast", "Schloss", "Tempel", "Arena"],
};

const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)];

/** Gewichtete Auswahl; Gewicht 0 = nie. Fällt auf gleichverteilt zurück, wenn alles 0 ist. */
function pickWeighted(items: readonly Part[], random: Random, weight?: (part: Part) => number): Part {
  if (!weight) return pick(items, random);
  const weights = items.map((p) => Math.max(0, weight(p)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(items, random);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export interface RandomOptions {
  /** Nur diese Teile verwenden (z. B. freigeschaltete). */
  isAvailable?: (part: Part) => boolean;
  /** Vorlieben: höheres Gewicht = häufiger (z. B. Bot-Charakter). */
  weight?: (part: Part) => number;
  /** Nutzung; ohne Angabe per Zufall. */
  use?: BuildingUse;
}
const between = (min: number, max: number, random: Random) => min + Math.floor(random() * (max - min + 1));

/**
 * Würfelt eine gültige Fassade (Konzept 6.2): genau ein Grundkörper, genau ein Dach,
 * mindestens eine Tür, 1–4 Fenster, 0–3 Deko-Teile.
 */
export function randomFacade(size: PlotSize, random: Random = Math.random, options: RandomOptions = {}): Facade {
  const { isAvailable = () => true, weight } = options;
  const usable = (category: Part["category"]) => partsOf(category).filter(isAvailable);
  const floors = between(1, ECONOMY.plotSizes[size].maxFloors, random) as 1 | 2 | 3;
  const columns = facadeColumns(size);
  const used = new Set<string>();
  const parts: PlacedPart[] = [];

  /** Setzt ein Teil auf einen zufälligen freien Platz; false, wenn keiner frei ist. */
  function place(part: Part): boolean {
    const layer = layerOf(part);
    const spots = allowedRows(part, floors).flatMap((y) => Array.from({ length: columns }, (_, x) => ({ x, y })));
    // Schilder nicht über Boden-Deko (Palme & Co.) hängen – die ragt in den oberen Streifen.
    const blocked = (s: { x: number; y: number }) => layer === "top" && used.has(cellKey(s, "ground-deco"));
    const free = shuffle(spots, random).find((s) => !used.has(cellKey(s, layer)) && !blocked(s));
    if (!free) return false;
    used.add(cellKey(free, layer));
    if (part.category === "deco" && layer === "main") used.add(cellKey(free, "ground-deco"));
    const placed: PlacedPart = { partId: part.id, ...free };
    if (part.id === "deco-sign") placed.text = pick(SIGN_WORDS, random);
    if (part.id === "deco-neon") placed.text = pick(NEON_WORDS, random);
    parts.push(placed);
    return true;
  }

  // Fenster-Anzahl vorab begrenzen, damit neben Türen immer Platz bleibt.
  const doorCount = size === "S" ? 1 : between(1, 2, random);
  const mainCells = columns * floors;
  const windowCount = Math.min(between(FACADE_RULES.minWindows, FACADE_RULES.maxWindows, random), mainCells - doorCount);

  const door = pickWeighted(usable("door"), random, weight);
  for (let i = 0; i < doorCount; i++) place(door);
  const window = pickWeighted(usable("window"), random, weight);
  for (let i = 0; i < windowCount; i++) place(window);

  // Boden-Deko vor Wand-Deko setzen, damit Schilder ihr ausweichen können. Findet ein Teil keinen Platz, entfällt es.
  const decoCount = between(0, FACADE_RULES.maxDeco, random);
  const decos = weightedSample(usable("deco"), decoCount, random, weight)
    .sort((a, b) => Number(layerOf(a) === "top") - Number(layerOf(b) === "top"));
  for (const deco of decos) place(deco);

  return {
    base: { partId: pickWeighted(usable("base"), random, weight).id },
    roof: { partId: pickWeighted(usable("roof"), random, weight).id },
    floors,
    parts,
  };
}

/** Zieht `count` verschiedene Teile, gewichtet. */
function weightedSample(items: readonly Part[], count: number, random: Random, weight?: (part: Part) => number): Part[] {
  const pool = shuffle(items, random);
  const result: Part[] = [];
  while (result.length < count && pool.length > 0) {
    const chosen = pickWeighted(pool, random, weight);
    result.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return result;
}

export function randomBuildingName(facade: Facade, size: PlotSize, random: Random = Math.random): string {
  const prefix = NAME_PREFIX[facade.base.partId] ?? "Wunder";
  return `${prefix}-${pick(NAME_NOUN[size], random)}`;
}

export function randomBuilding(size: PlotSize, random: Random = Math.random, options?: RandomOptions): Building {
  const facade = randomFacade(size, random, options);
  const use = options?.use ?? (random() < 0.5 ? "residential" : "commercial");
  return { id: createId(), name: randomBuildingName(facade, size, random), level: 1, createdBy: "random", use, facade };
}
