import { useOf } from "../game/life";
import type { Building } from "../model/types";
import { getPart } from "../parts/catalog";
import { FACADE_GRID } from "../parts/grid";

const { cellWidth: CW, cellHeight: CH, roofHeight: RH } = FACADE_GRID;
const INK = "#2b2118";

/**
 * Modernisierte Wohnhäuser sieht man: Stufe 2 bekommt Blumenkästen unter die Fenster,
 * Stufe 3 zusätzlich Balkongeländer oben und Laternen an der Haustür.
 */
export function Modernization({ building }: { building: Building }) {
  if (useOf(building) !== "residential" || building.level < 2) return null;
  const { facade } = building;
  const top = (y: number) => RH + (facade.floors - 1 - y) * CH;
  const flowerbox = getPart("deco-flowerbox")!.svg;
  const hasBox = new Set(facade.parts.filter((p) => p.partId === "deco-flowerbox").map((p) => `${p.x}:${p.y}`));
  const windows = facade.parts.filter((p) => getPart(p.partId)?.category === "window" && p.partId !== "window-balcony");
  const doors = facade.parts.filter((p) => getPart(p.partId)?.category === "door");
  const railings = building.level >= 3 ? windows.filter((w) => w.y > 0) : [];
  const boxes = windows.filter((w) => !hasBox.has(`${w.x}:${w.y}`) && !railings.includes(w));

  return (
    <g aria-hidden className="modernization">
      {boxes.map((w, i) => (
        <svg
          key={`b${i}`}
          x={w.x * CW}
          y={top(w.y)}
          width={CW}
          height={CH}
          viewBox={`0 0 ${CW} ${CH}`}
          overflow="visible"
          dangerouslySetInnerHTML={{ __html: flowerbox }}
        />
      ))}
      {railings.map((w, i) => (
        <g key={`r${i}`} transform={`translate(${w.x * CW} ${top(w.y)})`}>
          <rect x={3} y={40} width={34} height={4} rx={1} fill="#adb5bd" stroke={INK} strokeWidth={1.5} />
          <path d="M4 33h32M8 33v7M14 33v7M20 33v7M26 33v7M32 33v7" stroke={INK} strokeWidth={1.6} fill="none" />
          <circle cx={7} cy={31} r={2.5} fill="#ef476f" />
          <circle cx={33} cy={31} r={2.5} fill="#ffca3a" />
        </g>
      ))}
      {building.level >= 3 &&
        doors.map((d, i) => (
          <g key={`l${i}`} transform={`translate(${d.x * CW} ${top(0)})`}>
            {[3, 37].map((x) => (
              <g key={x}>
                <path d={`M${x} 20v6`} stroke={INK} strokeWidth={1.5} />
                <rect x={x - 2.5} y={26} width={5} height={7} rx={1.5} fill="#ffd166" stroke={INK} strokeWidth={1.2} />
              </g>
            ))}
          </g>
        ))}
    </g>
  );
}
