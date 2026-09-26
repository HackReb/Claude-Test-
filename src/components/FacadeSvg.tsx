import type { Facade, PlotSize } from "../model/types";
import { getPart, mountOf } from "../parts/catalog";
import { FACADE_GRID, facadeColumns, facadeDimensions } from "../parts/grid";

const { cellWidth, cellHeight, roofHeight, roofViewBox } = FACADE_GRID;
const ROOF_OVERHANG = 6;
// Zeichenreihenfolge vor dem Dach: Dach-Deko (Masten verschwinden hinter dem Dach).
// Danach: Fenster, Türen, Wand-Deko, Boden-Deko ganz vorne.
function drawOrder(category: string, mount: string): number {
  if (mount === "roof") return 0;
  if (category === "window") return 1;
  if (category === "door") return 2;
  return mount === "ground" ? 4 : 3;
}

/** Zeichnet eine Fassade im eigenen Koordinatensystem: (0,0) = oben links am Dach. */
export function FacadeSvg({ facade, size }: { facade: Facade; size: PlotSize }) {
  const columns = facadeColumns(size);
  const { width, height } = facadeDimensions(size, facade.floors);
  const floorTop = (floor: number) => roofHeight + (facade.floors - 1 - floor) * cellHeight;
  const base = getPart(facade.base.partId);
  const roof = getPart(facade.roof.partId);

  const placed = facade.parts
    .flatMap((placedPart) => {
      const part = getPart(placedPart.partId);
      return part ? [{ placedPart, part, order: drawOrder(part.category, mountOf(part)) }] : [];
    })
    .sort((a, b) => a.order - b.order);
  const roofParts = placed.filter((p) => p.order === 0);
  const frontParts = placed.filter((p) => p.order > 0);

  const renderPart = ({ placedPart, part }: (typeof placed)[number], i: number) => {
    const x = placedPart.x * cellWidth;
    const y = floorTop(placedPart.y);
    return (
      <g key={i}>
        <svg
          x={x}
          y={y}
          width={cellWidth}
          height={cellHeight}
          viewBox={`0 0 ${cellWidth} ${cellHeight}`}
          overflow="visible"
          dangerouslySetInnerHTML={{ __html: part.svg }}
        />
        {placedPart.text && part.textFill && (
          <text
            x={x + cellWidth / 2}
            y={y + 11.5}
            textAnchor="middle"
            fontSize={Math.min(9, 34 / (placedPart.text.length * 0.62))}
            fontWeight={900}
            fill={part.textFill}
          >
            {placedPart.text}
          </text>
        )}
      </g>
    );
  };

  return (
    <g>
      {base &&
        Array.from({ length: facade.floors * columns }, (_, i) => (
          <svg
            key={i}
            x={(i % columns) * cellWidth}
            y={roofHeight + Math.floor(i / columns) * cellHeight}
            width={cellWidth}
            height={cellHeight}
            viewBox={`0 0 ${cellWidth} ${cellHeight}`}
            dangerouslySetInnerHTML={{ __html: base.svg }}
          />
        ))}
      <rect x={0} y={roofHeight} width={width} height={height - roofHeight} fill="none" stroke="#2b2118" strokeWidth={3} />
      {roofParts.map(renderPart)}
      {roof && (
        <svg
          x={-ROOF_OVERHANG}
          y={0}
          width={width + 2 * ROOF_OVERHANG}
          height={roofHeight}
          viewBox={`0 0 ${roofViewBox.width} ${roofViewBox.height}`}
          preserveAspectRatio="none"
          overflow="visible"
          dangerouslySetInnerHTML={{ __html: roof.svg }}
        />
      )}
      {frontParts.map(renderPart)}
    </g>
  );
}
