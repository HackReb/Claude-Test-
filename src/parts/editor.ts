import { ECONOMY } from "../config/economy";
import type { Facade, PlacedPart, PlotSize } from "../model/types";
import { getPart } from "./catalog";
import { facadeColumns } from "./grid";
import { allowedRows, FACADE_RULES, layerOf } from "./rules";

// Bearbeitungsschritte des Baukastens. Alle Funktionen sind rein: alte Fassade rein, neue raus.

export type EditResult = { ok: true; facade: Facade } | { ok: false; reason: string };

export const TEXT_MAX_LENGTH = 10;
export const DEFAULT_SIGN_TEXT = "BABO";

const at = (p: Pick<PlacedPart, "x" | "y">, x: number, y: number) => p.x === x && p.y === y;
const layerAt = (facade: Facade, x: number, y: number, layer: string) =>
  facade.parts.find((p) => at(p, x, y) && getPart(p.partId) && layerOf(getPart(p.partId)!) === layer);

/** Teil an einer Stelle; bei mehreren das oberste (Schild vor Tür/Fenster vor Dach-Deko). */
export function partAt(facade: Facade, x: number, y: number): PlacedPart | undefined {
  return layerAt(facade, x, y, "top") ?? layerAt(facade, x, y, "main") ?? layerAt(facade, x, y, "roof");
}

/** Setzt ein Teil in eine Zelle. Ein Teil auf derselben Ebene wird ersetzt. */
export function placePart(facade: Facade, size: PlotSize, partId: string, x: number, y: number): EditResult {
  const part = getPart(partId);
  if (!part || part.category === "base" || part.category === "roof") return { ok: false, reason: "Dieses Teil gehört nicht ins Raster." };
  if (x < 0 || x >= facadeColumns(size)) return { ok: false, reason: "Außerhalb der Fassade." };
  if (!allowedRows(part, facade.floors).includes(y)) {
    const where = { roof: "aufs Dach", ground: "ins Erdgeschoss", wall: "an die Wand" }[part.mount ?? "wall"];
    return { ok: false, reason: `${part.name} gehört ${where}.` };
  }

  const layer = layerOf(part);
  const replaced = layerAt(facade, x, y, layer);
  const parts = facade.parts.filter((p) => p !== replaced);

  const limit = { window: FACADE_RULES.maxWindows, deco: FACADE_RULES.maxDeco, door: Infinity }[part.category];
  const sameCategory = parts.filter((p) => getPart(p.partId)?.category === part.category).length;
  if (sameCategory >= limit) {
    return { ok: false, reason: part.category === "window" ? `Höchstens ${limit} Fenster.` : `Höchstens ${limit} Deko-Teile.` };
  }

  const placed: PlacedPart = { partId, x, y };
  if (part.textFill) placed.text = replaced?.partId === partId && replaced.text ? replaced.text : DEFAULT_SIGN_TEXT;
  return { ok: true, facade: { ...facade, parts: [...parts, placed] } };
}

/** Entfernt das oberste Teil einer Zelle. */
export function removeAt(facade: Facade, x: number, y: number): Facade {
  const target = partAt(facade, x, y);
  return target ? { ...facade, parts: facade.parts.filter((p) => p !== target) } : facade;
}

/** Ändert den Text eines Schilds (Großbuchstaben, gekürzt). */
export function setText(facade: Facade, x: number, y: number, text: string): Facade {
  const clean = text.toUpperCase().slice(0, TEXT_MAX_LENGTH);
  return {
    ...facade,
    parts: facade.parts.map((p) => (at(p, x, y) && getPart(p.partId)?.textFill ? { ...p, text: clean } : p)),
  };
}

/** Stockwerke ändern: Teile in wegfallenden Stockwerken verschwinden, Dach-Deko wandert mit dem Dach. */
export function setFloors(facade: Facade, size: PlotSize, floors: number): Facade {
  const next = Math.min(Math.max(1, floors), ECONOMY.plotSizes[size].maxFloors) as 1 | 2 | 3;
  const parts = facade.parts.flatMap((p) => {
    const part = getPart(p.partId);
    if (part && layerOf(part) === "roof") return [{ ...p, y: next }];
    return p.y < next ? [p] : [];
  });
  return { ...facade, floors: next, parts };
}

/** Neue Fassade für den Baukasten: einfaches, gültiges Häuschen. */
export function starterFacade(): Facade {
  return {
    base: { partId: "base-brick" },
    roof: { partId: "roof-flat" },
    floors: 1,
    parts: [
      { partId: "door-shop", x: 0, y: 0 },
      { partId: "window-square", x: 1, y: 0 },
    ],
  };
}
