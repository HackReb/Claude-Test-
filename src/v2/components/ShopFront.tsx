import { FALLBACK_SHOP, shopType, type ShopLook } from "../config/shops";
import type { ItemDesign } from "../config/items";
import { ITEM_VIEWS, ItemSvg } from "./ItemSvg";

const INK = "#2b2118";

interface Props {
  type: string;
  name: string;
  look: number;
  width: number;
  height: number;
  /** Eigener Laden: dezent markieren. */
  mine?: boolean;
  /** Eine Ware aus dem Schaufenster (statt des Symbols). */
  item?: { id: string; design: ItemDesign } | null;
}

/** Ladenfront in der Mall: Wand, Schaufenster mit Symbol, Tür, Markise – und oben das Schild mit dem Namen. */
export function ShopFront({ type, name, look, width, height, mine = false, item = null }: Props) {
  const def = shopType(type) ?? FALLBACK_SHOP;
  const colors: ShopLook = def.looks[Math.min(Math.max(0, look), def.looks.length - 1)] ?? def.looks[0];
  const signH = 20;
  const front = height - signH;
  const label = name.length > 20 ? `${name.slice(0, 19)}…` : name;
  const fontSize = Math.max(6, Math.min(10.5, (width - 14) / (label.length * 0.62)));
  return (
    <g>
      {/* Schild */}
      <rect x={1} y={0} width={width - 2} height={signH} rx={4} fill={colors.awning} stroke={INK} strokeWidth={1.5} />
      <text x={width / 2} y={signH / 2 + fontSize * 0.36} textAnchor="middle" fontSize={fontSize} fontWeight={900} fill="#fff" stroke={INK} strokeWidth={2} paintOrder="stroke">
        {label}
      </text>
      {/* Wand */}
      <rect x={0} y={signH} width={width} height={front} fill={colors.wall} stroke={INK} strokeWidth={1.5} />
      {/* Schaufenster mit Symbol */}
      <rect x={8} y={signH + 12} width={width * 0.52} height={front - 24} rx={look === 2 ? 14 : 3} fill="#d7f3ff" stroke={INK} strokeWidth={1.5} />
      {item ? (
        <svg x={8} y={signH + 12} width={width * 0.52} height={front - 24} viewBox={ITEM_VIEWS[item.design.slot]} preserveAspectRatio="xMidYMid meet">
          <ItemSvg design={item.design} id={`win-${item.id}`} />
        </svg>
      ) : (
        <text x={8 + width * 0.26} y={signH + 12 + (front - 24) / 2 + 8} textAnchor="middle" fontSize={22}>
          {def.emoji}
        </text>
      )}
      {/* Tür */}
      <rect x={width * 0.66} y={signH + 16} width={width * 0.24} height={front - 16} rx={3} fill={colors.trim} stroke={INK} strokeWidth={1.5} />
      <circle cx={width * 0.66 + width * 0.24 - 6} cy={signH + 16 + (front - 16) / 2} r={1.6} fill="#ffd166" />
      {/* Markise / Vordach */}
      {look === 0 && (
        <g>
          <path d={`M4 ${signH + 6} H${width - 4} L${width - 8} ${signH + 16} H8 Z`} fill={colors.awning} stroke={INK} strokeWidth={1.3} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={10 + i * ((width - 20) / 5)} y={signH + 7} width={(width - 20) / 10} height={8} fill="#fff" opacity={0.6} />
          ))}
        </g>
      )}
      {look === 1 && <rect x={2} y={signH + 4} width={width - 4} height={6} rx={2} fill={colors.awning} stroke={INK} strokeWidth={1.2} />}
      {look === 2 && <path d={`M6 ${signH + 12} Q${width / 2} ${signH - 2} ${width - 6} ${signH + 12}`} fill="none" stroke={colors.awning} strokeWidth={4} />}
      {mine && <rect x={-2} y={-2} width={width + 4} height={height + 4} rx={5} fill="none" stroke="#ff7a45" strokeWidth={2.5} strokeDasharray="6 4" />}
    </g>
  );
}

/** Leerer Platz in der Mall: Rollladen, „frei“. */
export function EmptySlot({ width, height, available }: { width: number; height: number; available: boolean }) {
  return (
    <g>
      <rect x={0} y={0} width={width} height={height} fill="#e9e4da" stroke={INK} strokeWidth={1.5} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={6} y1={14 + i * 9} x2={width - 6} y2={14 + i * 9} stroke="#c9c1b3" strokeWidth={3} />
      ))}
      <rect x={width / 2 - 26} y={height / 2 - 11} width={52} height={22} rx={6} fill={available ? "#ffd166" : "#fff"} stroke={INK} strokeWidth={1.4} />
      <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={900} fill={INK}>
        {available ? "+ Laden" : "frei"}
      </text>
    </g>
  );
}
