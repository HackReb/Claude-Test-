import type { ReactNode } from "react";
import type { ItemDesign } from "../config/items";

const INK = "#2b2118";

/**
 * Zeichnet eine Ware im Figuren-Koordinatensystem (Figur schaut nach rechts, Füße bei y=0,
 * Kopfmitte bei (0,-33), Rumpf von y=-27 bis -11). Mit `wave` bewegen sich Teile (Peitsche, Ballon).
 */
export function ItemSvg({ design, wave = 0, id }: { design: ItemDesign; wave?: number; id: string }) {
  const [a, b, c] = design.colors;
  const pat = patternFill(id, design, a, b);
  const fill = pat.url;
  const pieces: Record<string, () => ReactNode> = {
    // ---------- Kopf ----------
    cap: () => (
      <g>
        <path d="M-7 -36 Q0 -46 7 -36 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <path d="M-7 -36 H11" stroke={INK} strokeWidth={1.3} />
        <path d="M4 -36 H12 Q12 -34 4 -34 Z" fill={b} stroke={INK} strokeWidth={1} />
      </g>
    ),
    tophat: () => (
      <g>
        <rect x={-9} y={-39} width={18} height={3} rx={1} fill={b} stroke={INK} strokeWidth={1} />
        <rect x={-6} y={-52} width={12} height={14} fill={fill} stroke={INK} strokeWidth={1.3} />
        <rect x={-6} y={-42} width={12} height={2.5} fill={c} />
      </g>
    ),
    crown: () => (
      <g>
        <path d="M-7 -38 L-7 -47 L-3.5 -42 L0 -49 L3.5 -42 L7 -47 L7 -38 Z" fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={0} cy={-46} r={1.4} fill={c} />
      </g>
    ),
    helmet: () => (
      <g>
        <path d="M-8 -36 Q0 -47 8 -36 L8 -31 L-8 -31 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <rect x={0} y={-35} width={8} height={4} fill={b} opacity={0.7} />
        <path d="M0 -47 L0 -50" stroke={c} strokeWidth={2} />
      </g>
    ),
    beanie: () => (
      <g>
        <path d="M-7 -36 Q0 -48 7 -36 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <rect x={-7.5} y={-37} width={15} height={3.5} rx={1.5} fill={b} stroke={INK} strokeWidth={1} />
        <circle cx={0} cy={-47} r={2.6} fill={c} stroke={INK} strokeWidth={1} />
      </g>
    ),
    wizard: () => (
      <g>
        <path d="M-9 -37 L9 -37 L1 -56 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <rect x={-10} y={-38} width={20} height={2.5} rx={1} fill={b} stroke={INK} strokeWidth={1} />
        <path d="M0 -47 l1 2 l2 0.5 l-1.5 1.5 l0.5 2 l-2 -1 l-2 1 l0.5 -2 l-1.5 -1.5 l2 -0.5 z" fill={c} />
      </g>
    ),
    pirate: () => (
      <g>
        <path d="M-10 -37 Q-9 -46 0 -46 Q9 -46 10 -37 Q0 -40 -10 -37 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <circle cx={0} cy={-42} r={1.8} fill="#fff" />
        <path d="M-1.5 -41 h3 M0 -43 v3" stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    cowboy: () => (
      <g>
        <path d="M-12 -37 Q-10 -34 0 -35 Q10 -34 12 -37 Q10 -39 6 -38 L5 -45 Q0 -47 -5 -45 L-6 -38 Q-10 -39 -12 -37 Z" fill={fill} stroke={INK} strokeWidth={1.3} />
        <path d="M-6 -39 H6" stroke={b} strokeWidth={1.5} />
      </g>
    ),
    antenna: () => (
      <g>
        <path d="M-4 -39 L-7 -50 M4 -39 L7 -50" stroke={INK} strokeWidth={1.3} />
        <circle cx={-7} cy={-50} r={2.2} fill={fill} stroke={INK} strokeWidth={1} />
        <circle cx={7} cy={-50} r={2.2} fill={b} stroke={INK} strokeWidth={1} />
      </g>
    ),
    bow: () => (
      <g transform="translate(-5 -40)">
        <path d="M0 0 L-5 -4 L-5 4 Z M0 0 L5 -4 L5 4 Z" fill={fill} stroke={INK} strokeWidth={1} />
        <circle r={1.5} fill={c} />
      </g>
    ),
    // ---------- Gesicht ----------
    glasses: () => (
      <g>
        <circle cx={3.5} cy={-33} r={3} fill={b} fillOpacity={0.35} stroke={fill === a ? a : INK} strokeWidth={1.3} />
        <circle cx={-3.5} cy={-33} r={3} fill={b} fillOpacity={0.35} stroke={fill === a ? a : INK} strokeWidth={1.3} />
        <path d="M-0.5 -33 H0.5" stroke={INK} strokeWidth={1} />
      </g>
    ),
    sunglasses: () => (
      <g>
        <rect x={0.5} y={-35.5} width={6} height={4.5} rx={2} fill={a} stroke={INK} strokeWidth={1} />
        <rect x={-6.5} y={-35.5} width={6} height={4.5} rx={2} fill={a} stroke={INK} strokeWidth={1} />
        <path d="M-0.5 -33.5 H0.5" stroke={INK} strokeWidth={1} />
      </g>
    ),
    monocle: () => (
      <g>
        <circle cx={3.5} cy={-33} r={3.2} fill={b} fillOpacity={0.3} stroke={a} strokeWidth={1.3} />
        <path d="M5 -30 q3 4 2 8" stroke={a} strokeWidth={0.8} fill="none" />
      </g>
    ),
    beard: () => <path d="M-6 -31 Q-6 -22 0 -22 Q6 -22 6 -31 Q3 -27 0 -27 Q-3 -27 -6 -31 Z" fill={a} stroke={INK} strokeWidth={1} />,
    mustache: () => <path d="M0 -29 Q3 -32 6 -29 Q4 -27 0 -29 Q-4 -27 -6 -29 Q-3 -32 0 -29 Z" fill={a} stroke={INK} strokeWidth={0.8} />,
    eyepatch: () => (
      <g>
        <circle cx={3.5} cy={-33} r={2.8} fill={a} stroke={INK} strokeWidth={1} />
        <path d="M1 -35 L-6 -38" stroke={INK} strokeWidth={1} />
      </g>
    ),
    mask: () => (
      <g>
        <path d="M-7 -35 Q0 -38 7 -35 Q7 -30 3.5 -31 Q0 -32 -3.5 -31 Q-7 -30 -7 -35 Z" fill={a} stroke={INK} strokeWidth={1} />
        <circle cx={3.5} cy={-33} r={1.1} fill="#fff" />
      </g>
    ),
    nose: () => <circle cx={6} cy={-31} r={2.4} fill={a} stroke={INK} strokeWidth={1} />,
    // ---------- Oberteil (über dem Rumpf -6..6, -27..-11) ----------
    shirt: () => <rect x={-6} y={-27} width={12} height={16} rx={5} fill={fill} stroke={INK} strokeWidth={1.8} />,
    jacket: () => (
      <g>
        <rect x={-6} y={-27} width={12} height={16} rx={5} fill={fill} stroke={INK} strokeWidth={1.8} />
        <path d="M0 -27 V-11" stroke={b} strokeWidth={2} />
        <path d="M-3 -27 L0 -23 L3 -27" fill={c} stroke={INK} strokeWidth={0.8} />
      </g>
    ),
    dress: () => <path d="M-6 -27 Q0 -28 6 -27 L9 -8 L-9 -8 Z" fill={fill} stroke={INK} strokeWidth={1.8} />,
    armor: () => (
      <g>
        <rect x={-7} y={-28} width={14} height={17} rx={4} fill={fill} stroke={INK} strokeWidth={1.8} />
        <path d="M-7 -22 H7 M-7 -17 H7" stroke={b} strokeWidth={1.2} />
        <circle cx={0} cy={-20} r={2} fill={c} stroke={INK} strokeWidth={0.8} />
      </g>
    ),
    suit: () => (
      <g>
        <rect x={-6} y={-27} width={12} height={16} rx={5} fill={fill} stroke={INK} strokeWidth={1.8} />
        <path d="M-3 -27 L0 -17 L3 -27 Z" fill="#fff" stroke={INK} strokeWidth={0.8} />
        <path d="M0 -26 L1.5 -22 L0 -19 L-1.5 -22 Z" fill={c} />
      </g>
    ),
    hoodie: () => (
      <g>
        <rect x={-6} y={-27} width={12} height={16} rx={5} fill={fill} stroke={INK} strokeWidth={1.8} />
        <path d="M-7 -28 Q0 -33 7 -28" fill="none" stroke={b} strokeWidth={2.2} />
        <rect x={-4} y={-15} width={8} height={3} rx={1} fill={b} />
      </g>
    ),
    coat: () => (
      <g>
        <rect x={-6.5} y={-27} width={13} height={17} rx={4} fill="#fff" stroke={INK} strokeWidth={1.8} />
        <path d="M0 -27 V-10" stroke={a} strokeWidth={1.2} />
        <rect x={-5} y={-24} width={3} height={2.5} fill={a} />
      </g>
    ),
    spacesuit: () => (
      <g>
        <rect x={-7} y={-28} width={14} height={17} rx={6} fill={fill} stroke={INK} strokeWidth={1.8} />
        <rect x={-4} y={-23} width={8} height={5} rx={1} fill={b} stroke={INK} strokeWidth={0.8} />
        <circle cx={-2} cy={-21} r={0.8} fill={c} />
        <circle cx={2} cy={-21} r={0.8} fill={c} />
      </g>
    ),
    stripes: () => (
      <g>
        <rect x={-6} y={-27} width={12} height={16} rx={5} fill="#fff" stroke={INK} strokeWidth={1.8} />
        <path d="M-6 -24 H6 M-6 -20 H6 M-6 -16 H6 M-6 -12 H6" stroke={a} strokeWidth={2} />
      </g>
    ),
    // ---------- Hose (über den Beinen -3..3, -12..0) ----------
    pants: () => <path d="M-4 -12 H4 L4.5 -1 H1.5 L0 -7 L-1.5 -1 H-4.5 Z" fill={fill} stroke={INK} strokeWidth={1.2} />,
    shorts: () => <path d="M-4 -12 H4 L4.5 -6 H1 L0 -8 L-1 -6 H-4.5 Z" fill={fill} stroke={INK} strokeWidth={1.2} />,
    skirt: () => <path d="M-4 -12 H4 L7 -4 H-7 Z" fill={fill} stroke={INK} strokeWidth={1.2} />,
    overalls: () => (
      <g>
        <path d="M-4 -12 H4 L4.5 -1 H1.5 L0 -7 L-1.5 -1 H-4.5 Z" fill={fill} stroke={INK} strokeWidth={1.2} />
        <rect x={-3} y={-24} width={6} height={12} fill={fill} stroke={INK} strokeWidth={1} />
        <path d="M-3 -24 L-5 -27 M3 -24 L5 -27" stroke={INK} strokeWidth={1.2} />
      </g>
    ),
    // ---------- Schuhe ----------
    sneakers: () => (
      <g>
        <path d="M-6 0 H-1 L-1 -3 H-5 Z" fill={a} stroke={INK} strokeWidth={1} />
        <path d="M1 0 H7 L7 -3 H2 Z" fill={a} stroke={INK} strokeWidth={1} />
        <path d="M-5 -1.2 H-1 M2 -1.2 H7" stroke={b} strokeWidth={1} />
      </g>
    ),
    boots: () => (
      <g>
        <path d="M-5.5 0 H-1 V-6 H-4.5 Z" fill={a} stroke={INK} strokeWidth={1} />
        <path d="M1 0 H6.5 V-6 H2 Z" fill={a} stroke={INK} strokeWidth={1} />
      </g>
    ),
    skates: () => (
      <g>
        <path d="M-6 -2 H-1 V-4 H-5 Z M1 -2 H7 V-4 H2 Z" fill={a} stroke={INK} strokeWidth={1} />
        <circle cx={-4.5} cy={0} r={1.4} fill={b} stroke={INK} strokeWidth={0.6} />
        <circle cx={-1.5} cy={0} r={1.4} fill={b} stroke={INK} strokeWidth={0.6} />
        <circle cx={2.5} cy={0} r={1.4} fill={b} stroke={INK} strokeWidth={0.6} />
        <circle cx={5.5} cy={0} r={1.4} fill={b} stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    flipflops: () => (
      <g>
        <path d="M-6 0 H-1 V-1.5 H-6 Z M1 0 H7 V-1.5 H1 Z" fill={a} stroke={INK} strokeWidth={0.8} />
        <path d="M-4 -1.5 L-3 -3.5 M4 -1.5 L5 -3.5" stroke={b} strokeWidth={1} />
      </g>
    ),
    heels: () => (
      <g>
        <path d="M-5 0 H-1 L-1 -3 H-4 Z M-5 0 V-2.5" fill={a} stroke={INK} strokeWidth={1} />
        <path d="M2 0 H6.5 L6.5 -3 H3 Z M2 0 V-2.5" fill={a} stroke={INK} strokeWidth={1} />
      </g>
    ),
    clown: () => (
      <g>
        <path d="M-9 0 H-1 L-1 -3 H-6 Q-9 -3 -9 0 Z" fill={a} stroke={INK} strokeWidth={1} />
        <path d="M1 0 H11 Q11 -3 8 -3 H2 Z" fill={b} stroke={INK} strokeWidth={1} />
      </g>
    ),
    // ---------- Hand (rechte Hand bei (7,-14)) ----------
    whip: () => (
      <g>
        <rect x={6} y={-17} width={2.5} height={6} fill={b} stroke={INK} strokeWidth={0.8} />
        <path d={`M8 -17 Q${16 + wave * 6} ${-30 + wave * 8} ${22 + wave * 10} ${-18 + wave * 14}`} fill="none" stroke={a} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ),
    sword: () => (
      <g transform="translate(7 -14) rotate(-30)">
        <rect x={-1.2} y={-20} width={2.4} height={18} fill={b} stroke={INK} strokeWidth={0.8} />
        <rect x={-4} y={-3} width={8} height={2} fill={c} stroke={INK} strokeWidth={0.6} />
        <rect x={-1} y={-1} width={2} height={5} fill={a} />
      </g>
    ),
    lightsaber: () => (
      <g transform="translate(7 -14) rotate(-35)">
        <rect x={-1.2} y={-1} width={2.4} height={6} fill="#adb5bd" stroke={INK} strokeWidth={0.8} />
        <line x1={0} y1={-1} x2={0} y2={-22} stroke={a} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
        <line x1={0} y1={-1} x2={0} y2={-22} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ),
    guitar: () => (
      <g transform="translate(3 -16) rotate(-25)">
        <ellipse cx={0} cy={0} rx={5} ry={3.5} fill={a} stroke={INK} strokeWidth={1} />
        <circle r={1.2} fill={INK} />
        <rect x={4} y={-1} width={10} height={2} fill={b} stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    umbrella: () => (
      <g>
        <line x1={8} y1={-14} x2={10} y2={-38} stroke={INK} strokeWidth={1} />
        <path d="M-2 -38 Q10 -50 22 -38 Z" fill={fill} stroke={INK} strokeWidth={1} />
      </g>
    ),
    wand: () => (
      <g>
        <line x1={7} y1={-14} x2={16} y2={-28} stroke={b} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M16 -31 l1 2 l2 0.5 l-1.5 1.5 l0.5 2 l-2 -1 l-2 1 l0.5 -2 l-1.5 -1.5 l2 -0.5 z" fill={a} />
      </g>
    ),
    balloon: () => (
      <g>
        <line x1={7} y1={-14} x2={11 + wave * 2} y2={-40} stroke={INK} strokeWidth={0.7} />
        <ellipse cx={11 + wave * 2} cy={-47} rx={6} ry={7.5} fill={fill} stroke={INK} strokeWidth={1} />
      </g>
    ),
    icecream: () => (
      <g transform="translate(8 -16)">
        <path d="M-2.5 0 L0 8 L2.5 0 Z" fill="#e9b872" stroke={INK} strokeWidth={0.8} />
        <circle cy={-2} r={3} fill={a} stroke={INK} strokeWidth={0.8} />
        <circle cx={-1} cy={-5.5} r={2.4} fill={b} stroke={INK} strokeWidth={0.8} />
      </g>
    ),
    phone: () => <rect x={6} y={-20} width={4} height={7} rx={1} fill={a} stroke={INK} strokeWidth={0.8} />,
    flower: () => (
      <g transform="translate(9 -18)">
        <line x1={0} y1={0} x2={0} y2={6} stroke="#2e7d32" strokeWidth={1} />
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx={0} cy={-3} rx={1.6} ry={2.6} fill={a} stroke={INK} strokeWidth={0.5} transform={`rotate(${r})`} />
        ))}
        <circle r={1.3} fill={c} />
      </g>
    ),
    ball: () => (
      <g>
        <circle cx={10} cy={-13} r={4} fill={fill} stroke={INK} strokeWidth={1} />
        <path d="M7 -15 Q10 -13 13 -15 M7 -11 Q10 -13 13 -11" fill="none" stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    trumpet: () => (
      <g>
        <path d="M7 -16 H16 L19 -19 V-13 L16 -16" fill={a} stroke={INK} strokeWidth={0.8} />
        <path d="M9 -16 V-19 M11 -16 V-19 M13 -16 V-19" stroke={b} strokeWidth={1} />
      </g>
    ),
    book: () => <rect x={6} y={-19} width={6} height={7} rx={0.5} fill={a} stroke={INK} strokeWidth={0.8} />,
    shield: () => (
      <g transform="translate(9 -16)">
        <path d="M-5 -6 H5 V2 Q0 7 -5 2 Z" fill={fill} stroke={INK} strokeWidth={1} />
        <path d="M0 -6 V5" stroke={c} strokeWidth={1} />
      </g>
    ),
    // ---------- Rücken (hinter dem Rumpf, nach links) ----------
    cape: () => <path d={`M-5 -26 L${-13 - wave * 2} ${-6 + wave * 2} L-6 -10 Z`} fill={fill} stroke={INK} strokeWidth={1.2} />,
    backpack: () => <rect x={-11} y={-25} width={6} height={11} rx={2} fill={fill} stroke={INK} strokeWidth={1.2} />,
    wings: () => (
      <g>
        <path d={`M-5 -24 Q-18 ${-32 - wave * 3} -14 -14 Q-9 -18 -5 -18 Z`} fill={fill} stroke={INK} strokeWidth={1} />
        <path d={`M-5 -24 Q-12 ${-26 - wave * 2} -11 -16`} fill="none" stroke={b} strokeWidth={0.8} />
      </g>
    ),
    jetpack: () => (
      <g>
        <rect x={-11} y={-26} width={5} height={10} rx={2} fill={a} stroke={INK} strokeWidth={1} />
        <path d="M-10 -16 L-9 -10 L-7 -16" fill="#ff7a45" />
      </g>
    ),
    parrot: () => (
      <g transform="translate(-7 -30)">
        <ellipse rx={2.6} ry={3.5} fill={a} stroke={INK} strokeWidth={0.8} />
        <circle cx={0.5} cy={-3.5} r={1.8} fill={b} stroke={INK} strokeWidth={0.7} />
        <path d="M2 -3.5 L4 -3 L2 -2.5 Z" fill={c} />
      </g>
    ),
    guitarcase: () => <path d="M-11 -26 Q-14 -18 -11 -10 Q-7 -10 -6 -18 Q-7 -26 -11 -26 Z" fill={fill} stroke={INK} strokeWidth={1.2} />,
    // ---------- Begleiter (neben der Figur, um x=20) ----------
    dog: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-6} rx={7} ry={4} fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={7} cy={-10} r={3.5} fill={a} stroke={INK} strokeWidth={1.2} />
        <path d="M5 -13 Q3 -15 4 -11" fill={b} stroke={INK} strokeWidth={0.8} />
        <circle cx={8.5} cy={-10.5} r={0.7} fill={INK} />
        <path d={`M-7 -7 L${-11} ${-11 + wave * 2}`} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-4 -3 V0 M-1 -3 V0 M3 -3 V0 M6 -3 V0" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ),
    cat: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-5} rx={6} ry={3.5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={6} cy={-9} r={3} fill={a} stroke={INK} strokeWidth={1.2} />
        <path d="M4 -11 L4 -14 L6 -11 M7 -11 L8.5 -14 L8.5 -11" fill={a} stroke={INK} strokeWidth={0.8} />
        <path d={`M-6 -6 Q-10 ${-12 + wave * 2} -8 -14`} fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={7} cy={-9.5} r={0.6} fill={INK} />
      </g>
    ),
    dino: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-8} rx={8} ry={5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <path d="M-8 -9 L-15 -13 L-9 -6 Z" fill={a} stroke={INK} strokeWidth={1} />
        <ellipse cx={8} cy={-15} rx={4.5} ry={3.5} fill={a} stroke={INK} strokeWidth={1.2} />
        <path d="M5 -13 L10 -13 M-4 -13 L-2 -17 L0 -13 L2 -17 L4 -13" fill={b} stroke={INK} strokeWidth={0.8} />
        <circle cx={10} cy={-16} r={0.8} fill={INK} />
        <path d="M-3 -3 V0 M3 -3 V0" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    ),
    dragon: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-8} rx={8} ry={4.5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <path d={`M-2 -12 Q-6 ${-22 - wave * 2} 2 -18 Z`} fill={b} stroke={INK} strokeWidth={0.8} />
        <path d="M-8 -9 L-15 -12 L-10 -6 Z" fill={a} stroke={INK} strokeWidth={1} />
        <ellipse cx={8} cy={-14} rx={4.5} ry={3.5} fill={a} stroke={INK} strokeWidth={1.2} />
        <path d="M7 -17 L8 -20 M10 -17 L11 -20" stroke={INK} strokeWidth={1} />
        <path d="M12 -13 l4 -1 l-4 -1 z" fill="#ff7a45" />
        <circle cx={10} cy={-15} r={0.8} fill={INK} />
        <path d="M-3 -4 V0 M3 -4 V0" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    ),
    unicorn: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-9} rx={8} ry={4.5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <ellipse cx={8} cy={-16} rx={3.5} ry={3} fill={a} stroke={INK} strokeWidth={1.2} />
        <path d="M9 -19 L11 -25 L12 -18" fill={c} stroke={INK} strokeWidth={0.8} />
        <path d="M4 -17 Q2 -22 6 -20 Q7 -23 9 -19" fill={b} stroke={INK} strokeWidth={0.6} />
        <path d="M-8 -10 Q-13 -8 -10 -3" fill="none" stroke={b} strokeWidth={2} />
        <path d="M-5 -5 V0 M-1 -5 V0 M3 -5 V0 M6 -5 V0" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        <circle cx={10} cy={-16.5} r={0.7} fill={INK} />
      </g>
    ),
    robot: () => (
      <g transform="translate(19 0)">
        <rect x={-5} y={-16} width={10} height={10} rx={1.5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <rect x={-4} y={-24} width={8} height={7} rx={1.5} fill={a} stroke={INK} strokeWidth={1.2} />
        <circle cx={-1.5} cy={-21} r={1} fill={c} />
        <circle cx={1.5} cy={-21} r={1} fill={c} />
        <path d="M0 -24 V-27" stroke={INK} strokeWidth={1} />
        <circle cx={0} cy={-27.5} r={1.2} fill={c} />
        <path d="M-3 -6 V0 M3 -6 V0" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    ),
    bird: () => (
      <g transform="translate(18 0)">
        <ellipse cy={-6} rx={4} ry={5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={1} cy={-12} r={2.6} fill={a} stroke={INK} strokeWidth={1} />
        <path d="M3.5 -12 L6 -11 L3.5 -10 Z" fill={c} />
        <path d="M-1 -2 V0 M1.5 -2 V0" stroke={c} strokeWidth={1.2} />
        <circle cx={2} cy={-12.5} r={0.6} fill={INK} />
      </g>
    ),
    fish: () => (
      <g transform="translate(19 0)">
        <rect x={-6} y={-14} width={12} height={14} rx={2} fill="#d7f3ff" stroke={INK} strokeWidth={1.2} />
        <path d="M-6 -11 Q0 -13 6 -11" fill="none" stroke="#90e0ef" strokeWidth={1} />
        <ellipse cx={0} cy={-7 + wave} rx={3.5} ry={2.2} fill={fill} stroke={INK} strokeWidth={0.8} />
        <path d={`M-3.5 ${-7 + wave} L-6 ${-9 + wave} L-6 ${-5 + wave} Z`} fill={a} stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    pig: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-6} rx={7} ry={4.5} fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={7} cy={-8} r={3.5} fill={a} stroke={INK} strokeWidth={1.2} />
        <ellipse cx={9.5} cy={-7.5} rx={1.6} ry={1.2} fill={b} stroke={INK} strokeWidth={0.6} />
        <path d="M-7 -7 q-3 -2 -2 1" fill="none" stroke={INK} strokeWidth={1} />
        <path d="M-4 -3 V0 M-1 -3 V0 M3 -3 V0 M6 -3 V0" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ),
    octopus: () => (
      <g transform="translate(20 0)">
        <ellipse cy={-11} rx={6} ry={6} fill={fill} stroke={INK} strokeWidth={1.2} />
        {[-5, -3, -1, 1, 3, 5].map((x, i) => (
          <path key={x} d={`M${x} -6 Q${x + (i % 2 ? 2 : -2)} ${-2 + wave} ${x} 0`} fill="none" stroke={a} strokeWidth={1.6} strokeLinecap="round" />
        ))}
        <circle cx={2} cy={-12} r={1.2} fill="#fff" stroke={INK} strokeWidth={0.5} />
        <circle cx={2.3} cy={-12} r={0.5} fill={INK} />
      </g>
    ),
    ghost: () => (
      <g transform={`translate(19 ${-4 + wave * 2})`}>
        <path d="M-5 -14 Q-5 -22 0 -22 Q5 -22 5 -14 V-4 L3 -6 L1 -4 L-1 -6 L-3 -4 L-5 -6 Z" fill={fill} fillOpacity={0.9} stroke={INK} strokeWidth={1.2} />
        <circle cx={-1.5} cy={-15} r={1} fill={INK} />
        <circle cx={1.5} cy={-15} r={1} fill={INK} />
      </g>
    ),
    // ---------- Fahrzeug (unter der Figur) ----------
    bike: () => (
      <g>
        <circle cx={-9} cy={-3} r={5} fill="none" stroke={INK} strokeWidth={1.4} />
        <circle cx={10} cy={-3} r={5} fill="none" stroke={INK} strokeWidth={1.4} />
        <path d="M-9 -3 L-2 -11 L6 -11 L10 -3 M-2 -11 L1 -3 L10 -3" fill="none" stroke={a} strokeWidth={1.6} />
        <path d="M-3 -12 H1" stroke={INK} strokeWidth={1.6} />
        <path d="M6 -11 L9 -14" stroke={INK} strokeWidth={1.4} />
      </g>
    ),
    scooter: () => (
      <g>
        <circle cx={-7} cy={-2} r={2.8} fill={b} stroke={INK} strokeWidth={1.2} />
        <circle cx={9} cy={-2} r={2.8} fill={b} stroke={INK} strokeWidth={1.2} />
        <path d="M-6 -4 H8" stroke={a} strokeWidth={2.4} />
        <path d="M8 -4 L11 -22 M8 -22 H14" stroke={a} strokeWidth={1.6} />
      </g>
    ),
    car: () => (
      <g>
        <path d="M-16 -4 L-14 -11 L-6 -12 L-3 -17 L9 -17 L13 -11 L17 -10 L17 -4 Z" fill={fill} stroke={INK} strokeWidth={1.4} />
        <path d="M-4 -12 L-2 -16 L8 -16 L10 -12 Z" fill="#d7f3ff" stroke={INK} strokeWidth={0.8} />
        <circle cx={-10} cy={-3} r={3.2} fill="#333" stroke={INK} strokeWidth={1} />
        <circle cx={11} cy={-3} r={3.2} fill="#333" stroke={INK} strokeWidth={1} />
      </g>
    ),
    rocket: () => (
      <g transform={`translate(0 ${wave})`}>
        <path d="M-6 -4 L-6 -14 Q0 -22 6 -14 L6 -4 Z" fill={fill} stroke={INK} strokeWidth={1.2} />
        <path d="M-6 -8 L-10 -2 L-6 -4 M6 -8 L10 -2 L6 -4" fill={a} stroke={INK} strokeWidth={1} />
        <circle cx={0} cy={-13} r={2} fill="#d7f3ff" stroke={INK} strokeWidth={0.8} />
        <path d={`M-3 -4 L0 ${3 + wave * 2} L3 -4 Z`} fill="#ff7a45" />
      </g>
    ),
    skateboard: () => (
      <g>
        <path d="M-10 -3 Q-12 -6 -9 -6 H9 Q12 -6 10 -3 Z" fill={fill} stroke={INK} strokeWidth={1.2} />
        <circle cx={-6} cy={-1} r={1.6} fill={b} stroke={INK} strokeWidth={0.6} />
        <circle cx={6} cy={-1} r={1.6} fill={b} stroke={INK} strokeWidth={0.6} />
      </g>
    ),
    broom: () => (
      <g transform={`translate(0 ${wave})`}>
        <path d="M-14 -6 L10 -10" stroke={b} strokeWidth={2} strokeLinecap="round" />
        <path d="M-14 -6 L-20 -2 L-18 -9 L-21 -10 Z" fill={a} stroke={INK} strokeWidth={1} />
      </g>
    ),
    horse: () => (
      <g>
        <path d="M-10 0 L8 -14" stroke={b} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M8 -14 L8 -20 L12 -20 L14 -17 L11 -14 Z" fill={a} stroke={INK} strokeWidth={1} />
        <circle cx={11} cy={-18} r={0.7} fill={INK} />
      </g>
    ),
  };
  const draw = pieces[design.shape] ?? pieces.shirt;
  return (
    <g className={`item item-${design.slot}`}>
      {pat.defs}
      {draw()}
    </g>
  );
}

/** Muster als Pattern-Fill (einmal je Ware, ID muss im Dokument eindeutig sein). */
function patternFill(id: string, design: ItemDesign, a: string, b: string): { url: string; defs: ReactNode } {
  if (design.pattern === "plain") return { url: a, defs: null };
  const pid = `p-${id}`;
  const size = 4;
  const body =
    design.pattern === "dots" ? (
      <circle cx={size / 2} cy={size / 2} r={1} fill={b} />
    ) : design.pattern === "stripes" ? (
      <rect x={0} y={0} width={size / 2} height={size} fill={b} />
    ) : (
      <>
        <rect x={0} y={0} width={size / 2} height={size / 2} fill={b} />
        <rect x={size / 2} y={size / 2} width={size / 2} height={size / 2} fill={b} />
      </>
    );
  return {
    url: `url(#${pid})`,
    defs: (
      <defs>
        <pattern id={pid} width={size} height={size} patternUnits="userSpaceOnUse">
          <rect width={size} height={size} fill={a} />
          {body}
        </pattern>
      </defs>
    ),
  };
}

/** Eine Ware allein, groß (für Listen, Schaufenster, Vorschau). */
export function ItemPreview({ design, id, size = 56 }: { design: ItemDesign; id: string; size?: number }) {
  return (
    <svg viewBox={ITEM_VIEWS[design.slot]} width={size} height={size} aria-hidden>
      <ItemSvg design={design} id={id} />
    </svg>
  );
}

/** Jeder Platz hat seinen Ausschnitt im Figuren-Koordinatensystem (viewBox). */
export const ITEM_VIEWS: Record<string, string> = {
    hat: "-16 -58 32 28",
    face: "-12 -42 24 20",
    top: "-12 -32 24 26",
    legs: "-12 -16 24 18",
    feet: "-12 -10 24 12",
    hand: "-2 -52 34 44",
    back: "-24 -34 24 30",
    pet: "4 -30 32 32",
    ride: "-24 -26 48 30",
};
