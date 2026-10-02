import type { ItemDesign, Slot } from "../config/items";
import type { Figure } from "../model/types";
import { ItemSvg } from "./ItemSvg";

const INK = "#2b2118";

interface Props {
  figure: Figure;
  /** Was die Figur trägt, je Platz (aufgelöste Designs). */
  worn: Partial<Record<Slot, ItemDesign>>;
  /** Eindeutiger Präfix für Muster-IDs. */
  id: string;
  /** Gehphase für die Beine (0 = stehen). */
  phase?: number;
  /** Kleine Bewegung für Peitsche, Umhang, Hund (-1..1). */
  wave?: number;
  bounce?: boolean;
}

/**
 * Die Figur eines Spielers im Figuren-Koordinatensystem (Füße bei y=0, schaut nach rechts).
 * Reihenfolge: Rücken, Fahrzeug, Beine/Hose, Schuhe, Rumpf/Oberteil, Hand, Kopf, Haare, Hut, Gesicht, Begleiter.
 */
export function FigureSvg({ figure, worn, id, phase = 0, wave = 0, bounce = false }: Props) {
  const swing = Math.sin(phase * 3) * 5;
  const hop = bounce ? -Math.abs(Math.sin(phase * 3)) * 6 : 0;
  const { skin, hair, hairStyle } = figure.base;
  const item = (slot: Slot) => (worn[slot] ? <ItemSvg design={worn[slot]!} id={`${id}-${slot}`} wave={wave} /> : null);
  return (
    <g transform={`translate(0 ${hop})`}>
      <ellipse cy={1 - hop} rx={8} ry={2.5} fill="#000" opacity={0.18} />
      {item("back")}
      {item("ride")}
      {/* Beine */}
      <path d={`M-2 -12 L${-2 + swing} 0 M2 -12 L${2 - swing} 0`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {item("legs")}
      {item("feet")}
      {/* Rumpf */}
      <rect x={-6} y={-27} width={12} height={16} rx={5} fill="#8d99ae" stroke={INK} strokeWidth={1.8} />
      {item("top")}
      {/* Arm */}
      <path d={`M0 -23 L${6 - swing * 0.6} -14`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {item("hand")}
      {/* Kopf */}
      <circle cy={-33} r={6.5} fill={skin} stroke={INK} strokeWidth={1.8} />
      <Hair style={hairStyle} color={hair} />
      <circle cx={3} cy={-33} r={1} fill={INK} />
      <path d="M2 -30 Q3.5 -29 5 -30" stroke={INK} strokeWidth={0.7} fill="none" />
      {item("hat")}
      {item("face")}
      {item("pet")}
    </g>
  );
}

function Hair({ style, color }: { style: Figure["base"]["hairStyle"]; color: string }) {
  switch (style) {
    case "bald":
      return null;
    case "long":
      return <path d="M-6.5 -34 Q-6 -41 0 -40.5 Q6 -41 6.5 -34 L5 -26 Q0 -28 -7 -24 Z" fill={color} stroke={INK} strokeWidth={0.6} />;
    case "curly":
      return (
        <g fill={color} stroke={INK} strokeWidth={0.6}>
          <circle cx={-5} cy={-37} r={3} />
          <circle cx={0} cy={-40} r={3.2} />
          <circle cx={5} cy={-37} r={3} />
          <circle cx={-3} cy={-40} r={2.5} />
          <circle cx={3} cy={-40} r={2.5} />
        </g>
      );
    case "bun":
      return (
        <g>
          <path d="M-6.5 -34 Q-6 -41 0 -40.5 Q6 -41 6.5 -34 Q3 -37 -6.5 -34 Z" fill={color} />
          <circle cx={-4} cy={-41} r={3} fill={color} stroke={INK} strokeWidth={0.6} />
        </g>
      );
    case "spiky":
      return <path d="M-6.5 -34 L-6 -42 L-3 -37 L-1 -44 L1 -37 L4 -43 L6.5 -34 Z" fill={color} stroke={INK} strokeWidth={0.6} />;
    default:
      return <path d="M-6.5 -34 Q-6 -41 0 -40.5 Q6 -41 6.5 -34 Q3 -37 -6.5 -34 Z" fill={color} />;
  }
}

/** Figur groß allein (Figur-Blatt, Spieler-Karte). */
export function FigurePreview({ figure, worn, id, size = 160 }: { figure: Figure; worn: Partial<Record<Slot, ItemDesign>>; id: string; size?: number }) {
  return (
    <svg viewBox="-30 -62 68 68" width={size} height={size} aria-hidden>
      <FigureSvg figure={figure} worn={worn} id={id} />
    </svg>
  );
}
