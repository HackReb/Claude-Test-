import { ECONOMY } from "../config/economy";
import type { Facade, Part, PlacedPart, PlotSize } from "../model/types";
import { getPart, mountOf } from "./catalog";
import { facadeColumns } from "./grid";

/** Gültigkeitsregeln einer Fassade (Konzept 6.2). */
export const FACADE_RULES = {
  minDoors: 1,
  minWindows: 1,
  maxWindows: 4,
  maxDeco: 3,
} as const;

/**
 * Ebene innerhalb einer Zelle – pro Zelle und Ebene höchstens ein Teil:
 * - "main": Tür, Fenster oder Boden-Deko
 * - "top": Wand-Deko im oberen Streifen (Schild, Neonschrift)
 * - "roof": Dach-Deko in der Dachreihe
 */
export function layerOf(part: Part): "main" | "top" | "roof" {
  const mount = mountOf(part);
  if (mount === "roof") return "roof";
  if (part.category === "deco" && mount === "wall") return "top";
  return "main";
}

/** Erlaubte Stockwerke (y) eines Teils bei `floors` Stockwerken. */
export function allowedRows(part: Part, floors: number): number[] {
  const mount = mountOf(part);
  if (mount === "roof") return [floors];
  if (mount === "ground") return [0];
  return Array.from({ length: floors }, (_, i) => i);
}

export const cellKey = (p: Pick<PlacedPart, "x" | "y">, layer: string) => `${p.x}:${p.y}:${layer}`;

/** Liefert alle Regelverstöße; leere Liste = gültig. */
export function validateFacade(facade: Facade, size: PlotSize): string[] {
  const errors: string[] = [];
  const maxFloors = ECONOMY.plotSizes[size].maxFloors;
  const columns = facadeColumns(size);

  if (getPart(facade.base.partId)?.category !== "base") errors.push("Genau ein Grundkörper nötig.");
  if (getPart(facade.roof.partId)?.category !== "roof") errors.push("Genau ein Dach nötig.");
  if (facade.floors < 1 || facade.floors > maxFloors) errors.push(`${size}-Grundstücke haben 1–${maxFloors} Stockwerke.`);

  const count = { door: 0, window: 0, deco: 0 };
  const used = new Set<string>();
  for (const placed of facade.parts) {
    const part = getPart(placed.partId);
    if (!part || part.category === "base" || part.category === "roof") {
      errors.push(`Unbekanntes Teil: ${placed.partId}`);
      continue;
    }
    count[part.category]++;
    if (placed.x < 0 || placed.x >= columns || !Number.isInteger(placed.x)) errors.push(`${part.name}: Spalte außerhalb.`);
    if (!allowedRows(part, facade.floors).includes(placed.y)) errors.push(`${part.name}: passt nicht in Reihe ${placed.y}.`);
    const key = cellKey(placed, layerOf(part));
    if (used.has(key)) errors.push(`${part.name}: Platz schon belegt.`);
    used.add(key);
  }

  if (count.door < FACADE_RULES.minDoors) errors.push("Mindestens eine Tür nötig.");
  if (count.window < FACADE_RULES.minWindows || count.window > FACADE_RULES.maxWindows)
    errors.push(`${FACADE_RULES.minWindows}–${FACADE_RULES.maxWindows} Fenster erlaubt.`);
  if (count.deco > FACADE_RULES.maxDeco) errors.push(`Höchstens ${FACADE_RULES.maxDeco} Deko-Teile.`);
  return errors;
}
