import { useOf } from "../game/life";
import type { Building, Facade, PlotSize } from "../model/types";
import { FACADE_GRID, facadeDimensions } from "../parts/grid";
import { FacadeLife } from "./FacadeLife";
import { FacadeSvg } from "./FacadeSvg";
import { Modernization } from "./Modernization";

const PAD = 10;
/** Mit Leben: Platz links und rechts, damit die Leute aus dem Bild laufen können, und ein Gehweg. */
const LIFE_PAD = 56;
const SIDEWALK = 10;

/**
 * Fassade als eigenständiges Bild, inkl. Platz für Dach-Deko und Dachüberstand.
 * Mit `building` sieht man auch die Modernisierung, mit `life` zusätzlich die Leute und Gags.
 */
export function FacadePreview({
  facade,
  size,
  label,
  maxHeight,
  building,
  life = false,
}: {
  facade: Facade;
  size: PlotSize;
  label: string;
  maxHeight?: number;
  building?: Building;
  life?: boolean;
}) {
  const { width, height } = facadeDimensions(size, facade.floors);
  const top = FACADE_GRID.topOverflow;
  const pad = life ? LIFE_PAD : PAD;
  const bottom = life ? SIDEWALK : 4;
  return (
    <svg
      className="facade-preview"
      viewBox={`${-pad} ${-top} ${width + 2 * pad} ${height + top + bottom}`}
      style={maxHeight ? { maxHeight } : undefined}
      role="img"
      aria-label={label}
    >
      {life && <rect x={-pad} y={height} width={width + 2 * pad} height={SIDEWALK} fill="#d6ccc2" />}
      <FacadeSvg facade={facade} size={size} />
      {building && <Modernization building={{ ...building, facade }} />}
      {life && building && <FacadeLife facade={facade} size={size} use={useOf(building)} seed={building.id} detail />}
    </svg>
  );
}
