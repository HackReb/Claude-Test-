import { ECONOMY } from "../config/economy";
import type { Building, BuildingUse, Facade, Part, PlacedPart, PlotSize } from "../model/types";
import { partsOf } from "../parts/catalog";
import { facadeColumns } from "../parts/grid";
import { allowedRows, cellKey, FACADE_RULES, layerOf } from "../parts/rules";
import { createId } from "./ids";
import { shuffle } from "./random";

type Random = () => number;

/**
 * Läden zum Würfeln: Namensideen (der Name steht aufs Ladenschild und entscheidet über den Gag in der Animation)
 * und – falls freigeschaltet – das passende Spezial-Fenster.
 */
const BUSINESSES: { names: string[]; window?: string }[] = [
  { names: ["Dönerbude", "Döner-Palast", "Kebab-Eck"], window: "window-doner" },
  { names: ["Optiker", "Brillen-Eck", "Optik Scharf"], window: "window-optician" },
  { names: ["Eisdiele", "Eis-Café", "Gelateria"], window: "window-icecream" },
  { names: ["Pizzeria", "Pizza-Blitz", "Pizza da Babo"] },
  { names: ["Friseur", "Haarscharf", "Friseur Schnipp"] },
  { names: ["Bäckerei", "Brezel-Eck", "Backstube"] },
  { names: ["Blumenladen", "Blumenzauber", "Blumen-Eck"] },
  { names: ["Späti", "Kiosk", "Büdchen"] },
  { names: ["Tattoo-Studio", "Nadelwerk", "Ink-Eck"] },
  { names: ["Waschsalon", "Wasch-Eck", "Waschsalon Blitzblank"] },
  { names: ["Kino", "Filmpalast", "Popcorn-Kino"] },
];

/** Sprüche für zusätzliche Schilder – der Ladenname steht schon oben am Ladenschild. */
const SLOGANS = ["OPEN", "24/7", "SALE", "NEU!", "TOP", "WOW"];

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
  /** Läden bekommen Ladenteile (Ladenwand, Ladendach, Ladentür), Wohnhäuser alles, was nicht nach Laden aussieht. */
  const typical = (category: Part["category"]) => {
    const all = usable(category);
    const own = all.filter((p) => p.use === use);
    return use === "commercial" && own.length > 0 ? own : all;
  };
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
    if (part.textFill) placed.text = text ?? pick(SLOGANS, random);
    parts.push(placed);
    return true;
  }

  // Fenster-Anzahl vorab begrenzen, damit neben Türen immer Platz bleibt.
  const doorCount = size === "S" ? 1 : between(1, 2, random);
  const mainCells = columns * floors;
  const windowCount = Math.min(between(FACADE_RULES.minWindows, Math.min(FACADE_RULES.maxWindows, mainCells), random), mainCells - doorCount);

  const door = pickWeighted(typical("door"), random, weight);
  for (let i = 0; i < doorCount; i++) place(door);

  const windows = usable("window");
  let business: (typeof BUSINESSES)[number] | undefined;
  let placedWindows = 0;
  if (use === "commercial") {
    // Erst der Laden, dann unten sein Schaufenster: Spezial-Fenster (Dönergrill, Eistheke …), wenn freigeschaltet.
    business = pick(BUSINESSES, random);
    const special = windows.find((w) => w.id === business!.window);
    const shopWindows = windows.filter((w) => w.use === "commercial" && !BUSINESSES.some((b) => b.window === w.id));
    const shopWindow = special ?? (shopWindows.length > 0 ? pickWeighted(shopWindows, random, weight) : undefined);
    if (shopWindow && place(shopWindow, undefined, [0])) placedWindows++;
  }
  // Wohnhäuser bekommen gemischte Fenster, Läden oben normale Fenster.
  const otherWindows = use === "commercial" ? windows.filter((w) => !w.use) : windows;
  for (let i = placedWindows; i < windowCount; i++) place(pickWeighted(otherWindows.length > 0 ? otherWindows : windows, random, weight));

  // Boden-Deko vor Wand-Deko setzen, damit Schilder ihr ausweichen können. Findet ein Teil keinen Platz, entfällt es.
  const decos = weightedSample(usable("deco"), between(0, FACADE_RULES.maxDeco, random), random, weight)
    .sort((a, b) => Number(layerOf(a) === "top") - Number(layerOf(b) === "top"));
  for (const deco of decos) place(deco);

  return {
    use,
    business,
    facade: {
      base: { partId: pickWeighted(typical("base"), random, weight).id },
      roof: { partId: pickWeighted(typical("roof"), random, weight).id },
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
