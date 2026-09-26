const INK = "#2b2118";

/** Spielplatz auf einem Grundstück: Schaukel, Rutsche in den Sandkasten. `groundY` = Bodenlinie. */
export function Playground({ width, groundY, animate = true }: { width: number; groundY: number; animate?: boolean }) {
  const s = Math.min(1, width / 124);
  return (
    <g transform={`translate(${width / 2} ${groundY}) scale(${s})`}>
      <ellipse rx={58} ry={7} fill="#000" opacity={0.12} />
      {/* Schaukel */}
      <path d="M-60 0 L-52 -48 L-28 -48 L-20 0" fill="none" stroke="#6d597a" strokeWidth={4} strokeLinejoin="round" />
      <g>
        {animate && (
          <animateTransform attributeName="transform" type="rotate" values="-14 -40 -48; 14 -40 -48; -14 -40 -48" dur="2.2s" repeatCount="indefinite" />
        )}
        <path d="M-46 -48 V-14 M-34 -48 V-14" stroke={INK} strokeWidth={1.5} />
        <rect x={-49} y={-15} width={18} height={4} rx={2} fill="#ef476f" stroke={INK} strokeWidth={1.5} />
      </g>
      {/* Sandkasten */}
      <rect x={14} y={-12} width={44} height={12} rx={3} fill="#f4d58d" stroke={INK} strokeWidth={2.5} />
      <circle cx={48} cy={-8} r={3} fill="#1982c4" />
      {/* Rutsche */}
      <path d="M-10 0 V-58 M4 0 V-58" stroke="#8d5a3b" strokeWidth={4} />
      <path d="M-10 -46 H4 M-10 -34 H4 M-10 -22 H4 M-10 -10 H4" stroke="#8d5a3b" strokeWidth={2.5} />
      <rect x={-13} y={-62} width={20} height={6} rx={2} fill="#06d6a0" stroke={INK} strokeWidth={2} />
      <path d="M6 -60 Q20 -40 30 -14 L36 -12" fill="none" stroke="#ffd166" strokeWidth={7} strokeLinecap="round" />
    </g>
  );
}
