import { FacadeSvg } from "../../components/FacadeSvg";
import { facadeDimensions } from "../../parts/grid";
import { houseFacade } from "../game/street";
import type { LotBox } from "./layout";
import { STAGE } from "./layout";

const INK = "#2b2118";
const STAGE_NAMES = ["Bauland", "Baustelle", "Häuschen", "Stadthaus", "Wohnblock"] as const;

/** Ein Bauplatz: Bauland, Baustelle oder ein gewachsenes Haus (Fassade fest je Platz). */
export function HouseLot({ box, streetId, t }: { box: LotBox; streetId: string; t: number }) {
  const { lot, x, y, width, ground } = box;
  const house = houseFacade(streetId, lot);
  return (
    <g className="house-lot" aria-label={`${STAGE_NAMES[lot.stage]}${lot.residents ? `, ${Math.round(lot.residents)} Bewohner` : ""}`}>
      <rect x={x} y={y} width={width} height={ground + STAGE.grass - y} rx={12} fill={lot.stage >= 2 ? "#8fcf8a" : "#b9dcae"} stroke={INK} strokeWidth={2} strokeDasharray={lot.stage === 0 ? "8 6" : undefined} />
      {lot.stage === 0 && (
        <g transform={`translate(${x + width / 2} ${ground - 28})`}>
          <rect x={-40} y={-18} width={80} height={26} rx={4} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <text textAnchor="middle" y={0} fontSize={10} fontWeight={800} fill="#7a6a5a">
            Bauland
          </text>
          <line x1={0} y1={8} x2={0} y2={28} stroke="#6b4226" strokeWidth={3} />
        </g>
      )}
      {lot.stage === 1 && <ConstructionSite x={x} width={width} ground={ground} t={t} />}
      {house && (
        <g transform={`translate(${x + (width - facadeDimensions(house.size, house.facade.floors).width) / 2} ${ground - facadeDimensions(house.size, house.facade.floors).height})`}>
          <FacadeSvg facade={house.facade} size={house.size} />
        </g>
      )}
    </g>
  );
}

function ConstructionSite({ x, width, ground, t }: { x: number; width: number; ground: number; t: number }) {
  const swing = Math.sin(t * 0.8) * 18;
  return (
    <g>
      {/* Bauzaun */}
      {Array.from({ length: Math.floor(width / 26) }, (_, i) => (
        <rect key={i} x={x + 10 + i * 26} y={ground - 26} width={18} height={26} fill={i % 2 ? "#ffd166" : "#fff"} stroke={INK} strokeWidth={1.2} />
      ))}
      {/* Kran */}
      <g transform={`translate(${x + width * 0.3} ${ground})`}>
        <rect x={-6} y={-150} width={12} height={150} fill="#ffb703" stroke={INK} strokeWidth={1.5} />
        <path d="M-6 -140 L6 -130 M-6 -120 L6 -110 M-6 -100 L6 -90 M-6 -80 L6 -70 M-6 -60 L6 -50 M-6 -40 L6 -30" stroke={INK} strokeWidth={1} />
        <g transform={`rotate(${swing * 0.3})`}>
          <rect x={-30} y={-158} width={150} height={8} fill="#ffb703" stroke={INK} strokeWidth={1.5} />
          <line x1={90} y1={-150} x2={90} y2={-60 + swing} stroke={INK} strokeWidth={1.2} />
          <rect x={78} y={-60 + swing} width={24} height={16} fill="#e07a5f" stroke={INK} strokeWidth={1.2} />
        </g>
      </g>
      <rect x={x + width - 70} y={ground - 40} width={50} height={22} rx={4} fill="#ff7a45" stroke={INK} strokeWidth={1.5} />
      <text x={x + width - 45} y={ground - 25} textAnchor="middle" fontSize={9} fontWeight={900} fill="#fff">
        Baustelle
      </text>
    </g>
  );
}
