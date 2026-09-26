import { ECONOMY } from "../../config/economy";
import type { Plot, PlotSize } from "../../model/types";

/** Maße der Straßen-Ansicht (SVG-Einheiten). */
export const STREET = {
  padX: 20,
  tile: 100,
  gap: 10,
  lotHeight: 220,
  slab: 8,
  topY: 16,
  sidewalk: 30,
  road: 60,
} as const;

export const lotWidth = (size: PlotSize) => {
  const tiles = ECONOMY.plotSizes[size].tiles;
  return tiles * STREET.tile + (tiles - 1) * STREET.gap;
};

export interface LotBox {
  plot: Plot;
  x: number;
  y: number;
  width: number;
}

/** Positionen aller Grundstücke: linke Straßenseite oben, rechte unten. */
export function layoutStreet(plots: Plot[]) {
  const roadTop = STREET.topY + STREET.lotHeight + STREET.slab + 8 + STREET.sidewalk;
  const roadBottom = roadTop + STREET.road;
  const bottomY = roadBottom + STREET.sidewalk + 8;
  const rowY = { left: STREET.topY, right: bottomY };

  const lots: LotBox[] = [];
  let rowWidth = 0;
  for (const side of ["left", "right"] as const) {
    let x = STREET.padX;
    for (const plot of plots.filter((p) => p.side === side).sort((a, b) => a.index - b.index)) {
      const width = lotWidth(plot.size);
      lots.push({ plot, x, y: rowY[side], width });
      x += width + STREET.gap;
    }
    rowWidth = Math.max(rowWidth, x - STREET.gap - STREET.padX);
  }

  return {
    lots,
    roadTop,
    roadBottom,
    width: rowWidth + 2 * STREET.padX,
    height: bottomY + STREET.lotHeight + STREET.slab + 16,
  };
}
