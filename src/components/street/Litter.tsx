import type { KeyboardEvent } from "react";
import { LIFE } from "../../config/life";
import type { LitterItem } from "../../model/types";

const INK = "#2b2118";

/** Müll oder Hundehaufen auf dem Gehweg – antippbar. */
export function Litter({ item, x, y, onTap }: { item: LitterItem; x: number; y: number; onTap?: (item: LitterItem) => void }) {
  const needed = LIFE.tapsToClean[item.kind];
  // Hundehaufen schrumpft mit jedem Tipper
  const scale = 1.3 * (1 - (item.taps / needed) * 0.45);
  const label = item.kind === "poop" ? `Hundehaufen wegmachen (noch ${needed - item.taps}× tippen)` : "Müll aufheben";
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap?.(item);
    }
  };
  return (
    <g
      className={`litter${onTap ? " tappable" : ""}`}
      transform={`translate(${x} ${y})`}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={onTap ? label : undefined}
      onClick={onTap ? () => onTap(item) : undefined}
      onKeyDown={onTap ? onKeyDown : undefined}
    >
      {/* großzügige Tippfläche */}
      <circle r={22} fill="transparent" />
      <g transform={`scale(${scale})`} className="litter-art">
        {item.kind === "poop" ? (
          <g>
            <ellipse cy={6} rx={11} ry={3} fill="#000" opacity={0.15} />
            <path d="M-10 5 Q-10 -1 -4 -1 Q-7 -6 -1 -8 Q2 -13 5 -7 Q10 -6 7 -1 Q11 0 10 5 Z" fill="#7b4a2a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
            <path d="M-5 1 Q0 3 5 1" fill="none" stroke="#5c3317" strokeWidth={1.2} />
            {/* Fliegen */}
            <circle cx={-8} cy={-14} r={1.4} fill={INK} className="fly" />
            <circle cx={8} cy={-17} r={1.4} fill={INK} className="fly fly-b" />
          </g>
        ) : (
          <g transform={`rotate(${(item.pos * 997) % 50 - 25})`}>
            <ellipse cy={6} rx={10} ry={2.5} fill="#000" opacity={0.15} />
            {item.pos * 1000 % 2 < 1 ? (
              // Dose
              <g>
                <rect x={-8} y={-4} width={16} height={9} rx={3} fill="#e63946" stroke={INK} strokeWidth={1.6} />
                <rect x={-4} y={-4} width={3} height={9} fill="#fff" opacity={0.7} />
              </g>
            ) : (
              // zerknülltes Papier
              <path d="M-8 3 L-6 -5 L0 -7 L6 -4 L8 3 L2 6 L-4 5 Z" fill="#fdfcf5" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            )}
          </g>
        )}
      </g>
      {item.kind === "poop" && item.taps > 0 && (
        <text y={-18} textAnchor="middle" fontSize={10} fontWeight={900} fill={INK}>
          {needed - item.taps}×
        </text>
      )}
    </g>
  );
}
