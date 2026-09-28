import { ECONOMY } from "../config/economy";
import type { Building, BuildingUse, Facade, Part, PlacedPart, PlotSize } from "../model/types";
import { partsOf } from "../parts/catalog";
import { facadeColumns } from "../parts/grid";
import { allowedRows, cellKey, FACADE_RULES, layerOf } from "../parts/rules";
import { createId } from "./ids";
import { shuffle } from "./random";

type Random = () => number;

/** Läden zum Würfeln: Schild-Text + Namensideen. Das Schild entscheidet auch über den Gag in der Animation. */
const BUSINESSES: { sign: string; names: string[]; window?: string }[] = [
  { sign: "DÖNER", names: ["Dönerbude", "Döner-Palast", "Kebab-Eck"], window: "window-doner" },
  { sign: "OPTIK", names: ["Optiker", "Brillen-Eck", "Scharfsicht"], window: "window-optician" },
  { sign: "EIS", names: ["Eisdiele", "Eis-Café", "Gelateria"], window: "window-icecream" },
  { sign: "PIZZA", names: ["Pizzeria", "Pizza-Blitz", "Da Babo"] },
  { sign: "HAARE", names: ["Friseur", "Haarscharf", "Salon Schnipp"] },
  { sign: "BÄCKER", names: ["Bäckerei", "Brezel-Eck", "Backstube"] },
  { sign: "BLUMEN", names: ["Blumenladen", "Blütenzauber", "Blumen-Eck"] },
  { sign: "SPÄTI", names: ["Späti", "Kiosk", "Büdchen"] },
  { sign: "TATTOO", names: ["Tattoo-Studio", "Nadelwerk", "Ink-Eck"] },
  { sign: "WASCH", names: ["Waschsalon", "Schleuder-Eck", "Blitzblank"] },
  { sign: "KINO", names: ["Kino", "Filmpalast", "Popcorn-Kino"] },
];
const NEON_WORDS = ["OPEN", "24/7", "LOVE", "WOW"];

const NAME_PREFIX: Record<string, string> = {
  "base-brick": "Backstein",
  "base-wood": "Holz",
  "base-chocolate": "Schoko",
  "base-gummy": "Gummi",
  "base-ice": "Eis",
};
const HOME_NOUN: Record<PlotSize, string[]> = {
  S: ["Häuschen", "Hütte", "Nest", "Bude"],
  M: ["Haus", "Villa", "Stadthaus", "Heim"],
  L: ["Palast", "Residenz", "Wohnschloss", "Block"],
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
 * mindestens eine Tür, Fenster, ein paar Deko-Teile. Mit Nutzung sieht sie danach aus:
 * Wohnhaus mit Haustür, gemischten Fenstern und Blumen, Gewerbe mit Schaufenster und Ladenschild.
 */
export function randomFacade(size: PlotSize, random: Random = Math.random, options: RandomOptions = {}): Facade {
  return rollFacade(size, random, options).facade;
}

function rollFacade(size: PlotSize, random: Random, options: RandomOptions): { facade: Facade; use: BuildingUse; business?: (typeof BUSINESSES)[number] } {
  const { isAvailable = () => true, weight } = options;
  const use: BuildingUse = options.use ?? (random() < 0.5 ? "residential" : "commercial");
  const fits = (part: Part) => !part.use || part.use === use;
  const usable = (category: Part["category"]) => partsOf(category).filter(isAvailable).filter(fits);
  const floors = between(1, ECONOMY.plotSizes[size].maxFloors, random) as 1 | 2 | 3;
  const columns = facadeColumns(size);
  const used = new Set<string>();
  const parts: PlacedPart[] = [];

  /** Setzt ein Teil auf einen zufälligen freien Platz (optional nur in bestimmten Reihen); false, wenn keiner frei ist. */
  function place(part: Part, text?: string, rows?: number[]): boolean {
    const layer = layerOf(part);
    const allowed = allowedRows(part, floors).filter((y) => !rows || rows.includes(y));
    const spots = allowed.flatMap((y) => Array.from({ length: columns }, (_, x) => ({ x, y })));
    // Schilder nicht über Boden-Deko (Palme & Co.) hängen – die ragt in den oberen Streifen.
    const blocked = (s: { x: number; y: number }) => layer === "top" && used.has(cellKey(s, "ground-deco"));
    const free = shuffle(spots, random).find((s) => !used.has(cellKey(s, layer)) && !blocked(s));
    if (!free) return false;
    used.add(cellKey(free, layer));
    if (part.category === "deco" && layer === "main") used.add(cellKey(free, "ground-deco"));
    const placed: PlacedPart = { partId: part.id, ...free };
    if (part.textFill) placed.text = text ?? (part.id === "deco-neon" ? pick(NEON_WORDS, random) : pick(BUSINESSES, random).sign);
    parts.push(placed);
    return true;
  }

  // Fenster-Anzahl vorab begrenzen, damit neben Türen immer Platz bleibt.
  const doorCount = size === "S" ? 1 : between(1, 2, random);
  const mainCells = columns * floors;
  const windowCount = Math.min(between(FACADE_RULES.minWindows, Math.min(FACADE_RULES.maxWindows, mainCells), random), mainCells - doorCount);

  const door = pickWeighted(usable("door"), random, weight);
  for (let i = 0; i < doorCount; i++) place(door);

  const windows = usable("window");
  let business: (typeof BUSINESSES)[number] | undefined;
  let placedWindows = 0;
  if (use === "commercial") {
    // Unten ein Schaufenster – ein freigeschaltetes Spezial-Fenster (Dönergrill, Eistheke …) bestimmt den Laden.
    const shopWindows = windows.filter((w) => w.use === "commercial");
    const shopWindow = shopWindows.length > 0 ? pickWeighted(shopWindows, random, weight) : undefined;
    business = BUSINESSES.find((b) => b.window === shopWindow?.id) ?? pick(BUSINESSES.filter((b) => !b.window), random);
    if (shopWindow && place(shopWindow, undefined, [0])) placedWindows++;
  }
  // Wohnhäuser bekommen gemischte Fenster, Läden oben normale Fenster.
  const otherWindows = use === "commercial" ? windows.filter((w) => !w.use) : windows;
  for (let i = placedWindows; i < windowCount; i++) place(pickWeighted(otherWindows.length > 0 ? otherWindows : windows, random, weight));

  // Läden haben immer ein Schild mit dem, was es gibt.
  let decoBudget = between(0, FACADE_RULES.maxDeco, random);
  if (business) {
    const signs = usable("deco").filter((d) => d.textFill);
    if (signs.length > 0 && place(pickWeighted(signs, random, weight), business.sign)) decoBudget = Math.max(0, decoBudget - 1);
  }

  // Boden-Deko vor Wand-Deko setzen, damit Schilder ihr ausweichen können. Findet ein Teil keinen Platz, entfällt es.
  const decos = weightedSample(usable("deco").filter((d) => !(business && d.textFill)), Math.min(decoBudget, FACADE_RULES.maxDeco - parts.filter((p) => p.partId.startsWith("deco")).length), random, weight)
    .sort((a, b) => Number(layerOf(a) === "top") - Number(layerOf(b) === "top"));
  for (const deco of decos) place(deco);

  return {
    use,
    business,
    facade: {
      base: { partId: pickWeighted(usable("base"), random, weight).id },
      roof: { partId: pickWeighted(usable("roof"), random, weight).id },
      floors,
      parts,
    },
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
  return `${prefix}-${pick(HOME_NOUN[size], random)}`;
}

export function randomBuilding(size: PlotSize, random: Random = Math.random, options?: RandomOptions): Building {
  const { facade, use, business } = rollFacade(size, random, options ?? {});
  const name = business ? pick(business.names, random) : randomBuildingName(facade, size, random);
  return { id: createId(), name, level: 1, createdBy: "random", use, facade };
}
