import type { Facade, Part, PlotSize } from "../../model/types";
import { FACADE_GRID, facadeColumns, facadeDimensions } from "../../parts/grid";
import { allowedRows } from "../../parts/rules";
import { FacadeSvg } from "../FacadeSvg";

const { cellWidth, cellHeight, roofHeight, topOverflow } = FACADE_GRID;
const PAD = 10;

interface Props {
  facade: Facade;
  size: PlotSize;
  /** Ausgewähltes Werkzeug: erlaubte Zellen werden hervorgehoben. */
  tool: Part | null;
  erasing: boolean;
  active: { x: number; y: number } | null;
  onCell: (x: number, y: number) => void;
}

/** Fassade mit antippbarem Raster (Stockwerke + Dachreihe). */
export function EditorCanvas({ facade, size, tool, erasing, active, onCell }: Props) {
  const { width, height } = facadeDimensions(size, facade.floors);
  const columns = facadeColumns(size);
  const allowed = new Set(tool ? allowedRows(tool, facade.floors) : []);

  const cells = [];
  for (let y = 0; y <= facade.floors; y++) {
    const isRoof = y === facade.floors;
    const top = isRoof ? -topOverflow : roofHeight + (facade.floors - 1 - y) * cellHeight;
    const h = isRoof ? roofHeight + topOverflow : cellHeight;
    for (let x = 0; x < columns; x++) {
      const highlight = allowed.has(y);
      const isActive = active?.x === x && active?.y === y;
      cells.push(
        <rect
          key={`${x}:${y}`}
          className={`editor-cell${highlight ? " target" : ""}${isActive ? " active" : ""}${erasing ? " erasing" : ""}`}
          x={x * cellWidth + 2}
          y={top + 2}
          width={cellWidth - 4}
          height={h - 4}
          rx={6}
          role="button"
          tabIndex={0}
          aria-label={isRoof ? `Dach, Spalte ${x + 1}` : `Stockwerk ${y + 1}, Spalte ${x + 1}`}
          onClick={() => onCell(x, y)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCell(x, y);
            }
          }}
        />,
      );
    }
  }

  return (
    <svg
      className="editor-canvas"
      viewBox={`${-PAD} ${-topOverflow - 4} ${width + 2 * PAD} ${height + topOverflow + 8}`}
      role="group"
      aria-label="Fassade bearbeiten"
    >
      <FacadeSvg facade={facade} size={size} />
      {cells}
    </svg>
  );
}
