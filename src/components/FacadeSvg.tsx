import type { Facade, PlotSize } from "../model/types";
import { getPart } from "../parts/catalog";
import { FACADE_GRID, facadeColumns, facadeDimensions } from "../parts/grid";

const { cellWidth, cellHeight, roofHeight, roofViewBox } = FACADE_GRID;
const ROOF_OVERHANG = 6;
const CATEGORY_ORDER = { door: 0, window: 1, deco: 2, base: 3, roof: 4 } as const;

/** Zeichnet eine Fassade im eigenen Koordinatensystem: (0,0) = oben links am Dach. */
export function FacadeSvg({ facade, size }: { facade: Facade; size: PlotSize }) {
  const columns = facadeColumns(size);
  const { width, height } = facadeDimensions(size, facade.floors);
  const floorTop = (floor: number) => roofHeight + (facade.floors - 1 - floor) * cellHeight;
  const base = getPart(facade.base.partId);
  const roof = getPart(facade.roof.partId);

  const placed = facade.parts
    .map((placedPart) => ({ placedPart, part: getPart(placedPart.partId) }))
    .filter((p) => p.part !== undefined)
    .sort((a, b) => CATEGORY_ORDER[a.part!.category] - CATEGORY_ORDER[b.part!.category]);

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
      {placed.map(({ placedPart, part }, i) => {
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
              dangerouslySetInnerHTML={{ __html: part!.svg }}
            />
            {placedPart.text && (
              <text
                x={x + cellWidth / 2}
                y={y + 11.5}
                textAnchor="middle"
                fontSize={Math.min(9, 34 / (placedPart.text.length * 0.62))}
                fontWeight={900}
                fill="#2b2118"
              >
                {placedPart.text}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
