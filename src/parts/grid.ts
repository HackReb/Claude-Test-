import { ECONOMY } from "../config/economy";
import type { PlotSize } from "../model/types";

/**
 * Raster der Fassade. Türen, Fenster und Deko sitzen in Zellen (x = Spalte, y = Stockwerk, 0 = Erdgeschoss).
 * Zell-Teile zeichnen in 40×50, Dächer in 100×30 (werden auf die Fassadenbreite gestreckt).
 */
export const FACADE_GRID = {
  cellWidth: 40,
  cellHeight: 50,
  roofHeight: 30,
  roofViewBox: { width: 100, height: 30 },
  /** Spalten je Kachel Grundstücksbreite. */
  columnsPerTile: 2,
} as const;

export function facadeColumns(size: PlotSize): number {
  return ECONOMY.plotSizes[size].tiles * FACADE_GRID.columnsPerTile;
}

export function facadeDimensions(size: PlotSize, floors: number): { width: number; height: number } {
  return {
    width: facadeColumns(size) * FACADE_GRID.cellWidth,
    height: FACADE_GRID.roofHeight + floors * FACADE_GRID.cellHeight,
  };
}
