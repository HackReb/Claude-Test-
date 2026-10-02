import { GROWTH, MALL } from "../config/growth";
import { mallFloors } from "../game/street";
import type { Lot, Shop } from "../model/types";

/** Maße der v2-Straße (SVG-Einheiten). Die Mall steht oben in der Mitte, Häuser wachsen daneben und gegenüber. */
export const STAGE = {
  padX: 24,
  lotWidth: 260,
  lotGap: 12,
  lotHeight: 240,
  grass: 16,
  topY: 24,
  sidewalk: 32,
  road: 64,
  mall: {
    slotWidth: 120,
    slotGap: 8,
    floorHeight: 78,
    roof: 42,
    padX: 16,
  },
} as const;

export const mallWidth = () => STAGE.mall.padX * 2 + MALL.shopsPerFloor * STAGE.mall.slotWidth + (MALL.shopsPerFloor - 1) * STAGE.mall.slotGap;
export const mallHeight = (floors: number) => STAGE.mall.roof + floors * STAGE.mall.floorHeight + 10;

export interface LotBox {
  lot: Lot;
  x: number;
  /** Oberkante des Grundstücks */
  y: number;
  width: number;
  /** y der Bodenlinie (Unterkante der Fassade) */
  ground: number;
}

export interface StageLayout {
  width: number;
  height: number;
  roadTop: number;
  roadBottom: number;
  topGround: number;
  mall: { x: number; y: number; width: number; height: number; floors: number; ground: number };
  lots: LotBox[];
  walkY: { top: number; bottom: number };
}

export function layoutStage(lots: Lot[], shops: Shop[]): StageLayout {
  const floors = mallFloors(shops);
  const mWidth = mallWidth();
  const mHeight = mallHeight(floors);
  const topRowHeight = Math.max(STAGE.lotHeight, mHeight);
  const topGround = STAGE.topY + topRowHeight - STAGE.grass;
  const sidewalkTop = STAGE.topY + topRowHeight + 8;
  const roadTop = sidewalkTop + STAGE.sidewalk;
  const roadBottom = roadTop + STAGE.road;
  const bottomY = roadBottom + STAGE.sidewalk + 8;

  const step = STAGE.lotWidth + STAGE.lotGap;
  const topWidth = GROWTH.lotsBesideMall * 2 * step + mWidth + STAGE.lotGap;
  const bottomWidth = GROWTH.lotsOpposite * step - STAGE.lotGap;
  const width = Math.max(topWidth, bottomWidth) + 2 * STAGE.padX;
  const topStart = STAGE.padX + (width - 2 * STAGE.padX - topWidth) / 2;
  const bottomStart = STAGE.padX + (width - 2 * STAGE.padX - bottomWidth) / 2;

  const mallX = topStart + GROWTH.lotsBesideMall * step;
  const boxes: LotBox[] = [];
  for (const lot of lots) {
    if (lot.row === "top") {
      const x = lot.index < GROWTH.lotsBesideMall ? topStart + lot.index * step : mallX + mWidth + STAGE.lotGap + (lot.index - GROWTH.lotsBesideMall) * step;
      boxes.push({ lot, x, y: STAGE.topY + topRowHeight - STAGE.lotHeight, width: STAGE.lotWidth, ground: topGround });
    } else {
      boxes.push({ lot, x: bottomStart + lot.index * step, y: bottomY, width: STAGE.lotWidth, ground: bottomY + STAGE.lotHeight - STAGE.grass });
    }
  }

  return {
    width,
    height: bottomY + STAGE.lotHeight + 16,
    roadTop,
    roadBottom,
    topGround,
    mall: { x: mallX, y: STAGE.topY + topRowHeight - mHeight, width: mWidth, height: mHeight, floors, ground: topGround },
    lots: boxes,
    walkY: { top: roadTop - 6, bottom: roadBottom + STAGE.sidewalk - 6 },
  };
}

/** Mitte eines Laden-Platzes in der Mall (x) – Stockwerk 0 unten. */
export function mallSlot(mall: StageLayout["mall"], index: number): { x: number; y: number; width: number; height: number; floor: number } {
  const floor = Math.floor(index / MALL.shopsPerFloor);
  const column = index % MALL.shopsPerFloor;
  const x = mall.x + STAGE.mall.padX + column * (STAGE.mall.slotWidth + STAGE.mall.slotGap);
  const y = mall.ground - 10 - (floor + 1) * STAGE.mall.floorHeight;
  return { x, y, width: STAGE.mall.slotWidth, height: STAGE.mall.floorHeight, floor };
}
