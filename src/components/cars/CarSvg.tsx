import type { CarType } from "../../config/cars";

const INK = "#2b2118";
const GLASS = "#bde0fe";

/** Karosserie je Typ, Seitenansicht nach rechts: x 0…length, y −Höhe…0 (0 = Straße). */
const SHAPES: Record<CarType, { length: number; body: string; windows: string[]; wheel: number; extra?: string }> = {
  hatch: {
    length: 64,
    body: "M4 -9 L4 -20 Q6 -24 14 -25 L22 -36 Q24 -38 30 -38 L44 -38 Q50 -38 54 -30 L60 -24 Q64 -22 64 -16 L64 -9 Z",
    windows: ["M24 -34 L30 -35 L36 -35 L36 -26 L21 -26 Z", "M38 -35 L43 -35 Q47 -35 50 -29 L52 -26 L38 -26 Z"],
    wheel: 7,
  },
  van: {
    length: 74,
    body: "M4 -9 L4 -40 Q4 -47 12 -47 L60 -47 Q69 -47 71 -37 L74 -22 L74 -9 Z",
    windows: ["M10 -43 H24 V-32 H10 Z", "M28 -43 H42 V-32 H28 Z", "M46 -43 H58 V-32 H46 Z", "M61 -43 L66 -43 L70 -32 L61 -32 Z"],
    wheel: 7.5,
    // Hippie-Bulli: helle Oberhälfte
    extra: '<path d="M4 -29 L4 -40 Q4 -47 12 -47 L60 -47 Q69 -47 71 -37 L72 -29 Z" fill="#fdf6e3" stroke="#2b2118" stroke-width="2"/><circle cx="37" cy="-20" r="5" fill="#ffca3a" stroke="#2b2118" stroke-width="1.2"/><circle cx="37" cy="-20" r="2" fill="#ef476f"/>',
  },
  sedan: {
    length: 86,
    body: "M4 -9 L4 -19 Q4 -24 12 -25 L28 -27 L38 -38 Q40 -40 46 -40 L60 -40 Q64 -40 68 -34 L72 -27 L82 -25 Q86 -24 86 -18 L86 -9 Z",
    windows: ["M40 -36 L47 -37 L52 -37 L52 -28 L36 -28 Z", "M54 -37 L59 -37 Q62 -37 65 -32 L67 -28 L54 -28 Z"],
    wheel: 7.5,
    // Sternchen auf der Haube
    extra: '<path d="M80 -29 l1 2.2 2.4 .3 -1.8 1.6 .5 2.4 -2.1 -1.2 -2.1 1.2 .5 -2.4 -1.8 -1.6 2.4 -.3z" fill="#ffd166" stroke="#2b2118" stroke-width=".8"/>',
  },
  suv: {
    length: 82,
    body: "M4 -12 L4 -27 Q4 -31 10 -32 L20 -33 L28 -45 Q30 -47 36 -47 L62 -47 Q66 -47 70 -41 L74 -33 Q82 -32 82 -26 L82 -12 Z",
    windows: ["M31 -43 L36 -44 L48 -44 L48 -34 L25 -34 Z", "M50 -44 L61 -44 Q64 -44 67 -39 L70 -34 L50 -34 Z"],
    wheel: 9,
    extra: '<rect x="2" y="-50" width="60" height="3" rx="1.5" fill="#555"/>',
  },
  sport: {
    length: 80,
    body: "M4 -8 L4 -17 Q4 -21 10 -22 L26 -25 Q34 -35 46 -35 Q58 -35 66 -25 L75 -21 Q80 -19 80 -13 L80 -8 Z",
    windows: ["M33 -30 Q38 -33 45 -33 Q53 -33 59 -27 L31 -27 Z"],
    wheel: 7.5,
    extra: '<path d="M1 -27 H11 V-23 H6 Z" fill="#2b2118"/><path d="M10 -15 H70" stroke="#fff" stroke-width="2.5" opacity=".7"/>',
  },
  ev: {
    length: 78,
    body: "M4 -9 L4 -19 Q6 -25 16 -26 Q28 -39 44 -39 Q60 -39 68 -27 Q78 -25 78 -17 L78 -9 Z",
    windows: ["M26 -29 Q32 -36 44 -36 Q56 -36 62 -29 Z"],
    wheel: 7.5,
    extra: '<path d="M42 -23 L37 -15 L42 -15 L39 -8 L47 -18 L42 -18 L45 -23 Z" fill="#ffca3a" stroke="#2b2118" stroke-width="1"/>',
  },
  tiny: {
    length: 56,
    body: "M4 -9 L4 -21 Q6 -36 26 -37 Q46 -37 50 -24 Q56 -22 56 -16 L56 -9 Z",
    windows: ["M14 -26 Q16 -33 26 -34 L28 -34 L28 -26 Z", "M31 -34 Q42 -34 45 -26 L31 -26 Z"],
    wheel: 6.5,
  },
  retro: {
    length: 64,
    body: "M4 -9 L4 -24 L14 -25 L20 -36 L44 -36 L50 -25 L64 -23 L64 -9 Z",
    windows: ["M22 -33 L31 -33 L31 -26 L18 -26 Z", "M34 -33 L42 -33 L46 -26 L34 -26 Z"],
    wheel: 6.5,
  },
};

export const carLength = (type: CarType) => SHAPES[type].length;

/**
 * Auto in Seitenansicht. Ursprung: vorne unten = (length, 0) zeigt nach rechts;
 * `dir = -1` spiegelt es für die Gegenrichtung.
 */
export function CarSvg({
  type,
  color,
  plate,
  dir = 1,
  spin = 0,
}: {
  type: CarType;
  color: string;
  plate?: string;
  dir?: 1 | -1;
  /** Radumdrehung in Grad (für die Fahranimation). */
  spin?: number;
}) {
  const shape = SHAPES[type];
  const L = shape.length;
  const wheels = [L * 0.22, L * 0.78];
  const r = shape.wheel;
  return (
    <g transform={dir === -1 ? `translate(${L} 0) scale(-1 1)` : undefined}>
      <ellipse cx={L / 2} cy={1} rx={L / 2 + 2} ry={3} fill="#000" opacity={0.25} />
      <path d={shape.body} fill={color} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      {shape.extra && <g dangerouslySetInnerHTML={{ __html: shape.extra }} />}
      {shape.windows.map((d, i) => (
        <path key={i} d={d} fill={GLASS} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      ))}
      {/* Scheinwerfer vorne, Rücklicht hinten */}
      <rect x={L - 5} y={-19} width={4} height={4} rx={1.5} fill="#fff6b0" stroke={INK} strokeWidth={1} />
      <rect x={3} y={-19} width={3} height={4} rx={1} fill="#e63946" stroke={INK} strokeWidth={1} />
      {plate && (
        // Nummernschild hinten (bei gespiegelten Autos trotzdem lesbar)
        <g transform={dir === -1 ? "translate(22 0) scale(-1 1)" : undefined}>
          <rect x={4} y={-15} width={14} height={5.5} rx={1} fill="#fff" stroke={INK} strokeWidth={0.8} />
          <rect x={4} y={-15} width={2} height={5.5} fill="#1a4fb5" />
          <text x={12} y={-11} textAnchor="middle" fontSize={3.2} fontWeight={800} fill={INK}>
            {plate.slice(0, 10)}
          </text>
        </g>
      )}
      {wheels.map((cx) => (
        <g key={cx} transform={`translate(${cx} ${-r}) rotate(${spin})`}>
          <circle r={r} fill="#2b2118" />
          <circle r={r * 0.45} fill="#c9c9c9" />
          <path d={`M0 ${-r * 0.45} V${r * 0.45}`} stroke="#777" strokeWidth={1.2} />
        </g>
      ))}
    </g>
  );
}
