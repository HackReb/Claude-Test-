import type { Facade, PlotSize } from "../model/types";
import { FACADE_GRID, facadeDimensions } from "../parts/grid";
import { FacadeSvg } from "./FacadeSvg";

const PAD = 10;

/** Fassade als eigenständiges Bild, inkl. Platz für Dach-Deko und Dachüberstand. */
export function FacadePreview({ facade, size, label, maxHeight }: { facade: Facade; size: PlotSize; label: string; maxHeight?: number }) {
  const { width, height } = facadeDimensions(size, facade.floors);
  const top = FACADE_GRID.topOverflow;
  return (
    <svg
      className="facade-preview"
      viewBox={`${-PAD} ${-top} ${width + 2 * PAD} ${height + top + 4}`}
      style={maxHeight ? { maxHeight } : undefined}
      role="img"
      aria-label={label}
    >
      <FacadeSvg facade={facade} size={size} />
    </svg>
  );
}
