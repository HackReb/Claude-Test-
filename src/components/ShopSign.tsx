import { useOf } from "../game/life";
import type { Building, PlotSize } from "../model/types";
import { FACADE_GRID, facadeDimensions } from "../parts/grid";

const INK = "#2b2118";
const CHAR_WIDTH = 0.62;
const MAX_FONT = 12;
/** Kleiner wird die Schrift nicht – lange Namen kommen dann auf zwei Zeilen. */
const MIN_FONT = 8;

/** Teilt einen Namen an der Leerstelle, die ihn am gleichmäßigsten halbiert („Kalles“ / „Döner-Imbiss“). */
function splitName(name: string): string[] {
  const spaces = [...name].flatMap((c, i) => (c === " " ? [i] : []));
  if (spaces.length === 0) return [name];
  const middle = name.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best));
  return [name.slice(0, at), name.slice(at + 1)];
}

/** Läden tragen ihren Namen groß oben am Ladenschild – den Namen gibt man nur einmal ein. */
export function ShopSign({ building, size }: { building: Building; size: PlotSize }) {
  const name = building.name.trim();
  if (useOf(building) !== "commercial" || !name) return null;
  const { width } = facadeDimensions(size, building.facade.floors);
  const room = width - 14;
  const fontFor = (lines: string[]) => Math.min(MAX_FONT, room / (Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH));
  let lines = [name];
  if (fontFor(lines) < MIN_FONT) lines = splitName(name);
  const fontSize = Math.max(5, fontFor(lines));
  const longest = Math.max(...lines.map((l) => l.length));
  const boardWidth = Math.min(width - 4, longest * fontSize * CHAR_WIDTH + 14);
  const lineHeight = fontSize * 1.1;
  const height = lines.length * lineHeight + 7;
  const y = FACADE_GRID.roofHeight - height - 5;
  return (
    <g className="shop-sign" aria-hidden>
      <rect x={(width - boardWidth) / 2} y={y} width={boardWidth} height={height} rx={4} fill="#ffd166" stroke={INK} strokeWidth={2.5} />
      {lines.map((line, i) => (
        <text key={i} x={width / 2} y={y + 3.5 + lineHeight * (i + 0.78)} textAnchor="middle" fontSize={fontSize} fontWeight={900} fill={INK}>
          {line}
        </text>
      ))}
    </g>
  );
}
