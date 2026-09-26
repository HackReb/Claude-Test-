import { ECONOMY } from "../config/economy";
import type { Building, Facade, Part, PlacedPart, PlotSize } from "../model/types";
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
const between = (min: number, max: number, random: Random) => min + Math.floor(random() * (max - min + 1));

/**
 * Würfelt eine gültige Fassade (Konzept 6.2): genau ein Grundkörper, genau ein Dach,
 * mindestens eine Tür, 1–4 Fenster, 0–3 Deko-Teile.
 */
export function randomFacade(size: PlotSize, random: Random = Math.random): Facade {
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

  const door = pick(partsOf("door"), random);
  for (let i = 0; i < doorCount; i++) place(door);
  const window = pick(partsOf("window"), random);
  for (let i = 0; i < windowCount; i++) place(window);

  // Boden-Deko vor Wand-Deko setzen, damit Schilder ihr ausweichen können. Findet ein Teil keinen Platz, entfällt es.
  const decoCount = between(0, FACADE_RULES.maxDeco, random);
  const decos = shuffle(partsOf("deco"), random)
    .slice(0, decoCount)
    .sort((a, b) => Number(layerOf(a) === "top") - Number(layerOf(b) === "top"));
  for (const deco of decos) place(deco);

  return {
    base: { partId: pick(partsOf("base"), random).id },
    roof: { partId: pick(partsOf("roof"), random).id },
    floors,
    parts,
  };
}

export function randomBuildingName(facade: Facade, size: PlotSize, random: Random = Math.random): string {
  const prefix = NAME_PREFIX[facade.base.partId] ?? "Wunder";
  return `${prefix}-${pick(NAME_NOUN[size], random)}`;
}

export function randomBuilding(size: PlotSize, random: Random = Math.random): Building {
  const facade = randomFacade(size, random);
  return { id: createId(), name: randomBuildingName(facade, size, random), level: 1, createdBy: "random", facade };
}
