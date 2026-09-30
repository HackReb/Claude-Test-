import { useEffect, useState } from "react";
import { ALIENS } from "../../config/aliens";

const INK = "#2b2118";
const { flyIn, aim, laser, flyOut } = ALIENS.timing;
/** Ab hier trifft der Laser (Sekunden nach dem Start). */
export const UFO_HIT_AT = flyIn + aim + laser * 0.45;

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

interface Props {
  /** Mitte des getroffenen Hauses (x) und seine Dachkante (y) in Straßen-Koordinaten. */
  targetX: number;
  roofY: number;
  /** Breite der ganzen Straße – das UFO kommt von links außerhalb und verschwindet rechts oben. */
  width: number;
  startedAt: number;
}

/** UFO fliegt ein, zielt, schießt mit dem Laser aufs Haus und haut wieder ab. Zeitgesteuert per requestAnimationFrame. */
export function UfoAttack({ targetX, roofY, width, startedAt }: Props) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = (now - startedAt) / 1000;
  const hoverY = Math.max(24, roofY - 70);
  const startX = targetX - Math.min(700, width);
  let x: number;
  let y: number;
  let tilt = 0;
  if (t < flyIn) {
    const p = ease(clamp01(t / flyIn));
    x = startX + (targetX - startX) * p;
    y = hoverY - 60 * (1 - p) + Math.sin(t * 6) * 4;
    tilt = 12 * (1 - p);
  } else if (t < flyIn + aim + laser) {
    x = targetX + Math.sin(t * 3) * 3;
    y = hoverY + Math.sin(t * 5) * 3;
  } else {
    const p = clamp01((t - flyIn - aim - laser) / flyOut);
    x = targetX + 900 * p * p;
    y = hoverY - 220 * p * p + Math.sin(t * 6) * 3;
    tilt = -14 * p;
  }

  const laserOn = t > flyIn + aim && t < flyIn + aim + laser;
  const charging = t > flyIn && t < flyIn + aim;
  const hit = t > UFO_HIT_AT;
  const sinceHit = t - UFO_HIT_AT;
  const blink = Math.floor(t * 8) % 2 === 0;

  return (
    <g className="ufo-attack" aria-hidden pointerEvents="none">
      {laserOn && (
        <g opacity={0.75 + Math.sin(t * 60) * 0.25}>
          <polygon points={`${x - 9},${y + 16} ${x + 9},${y + 16} ${targetX + 24},${roofY + 6} ${targetX - 24},${roofY + 6}`} fill="#b7ff5a" opacity={0.55} />
          <line x1={x} y1={y + 16} x2={targetX} y2={roofY + 6} stroke="#f4ffe0" strokeWidth={5} strokeLinecap="round" />
        </g>
      )}
      {hit && sinceHit < 0.5 && <circle cx={targetX} cy={roofY + 10} r={20 + sinceHit * 120} fill="#fff6b0" opacity={1 - sinceHit * 2} />}
      {hit && sinceHit < 3 && (
        <g>
          {[-14, 0, 14].map((dx, i) => (
            <circle
              key={dx}
              cx={targetX + dx + sinceHit * (i - 1) * 8}
              cy={roofY - 4 - sinceHit * 26 - i * 4}
              r={7 + sinceHit * 8}
              fill="#6c6c6c"
              opacity={Math.max(0, 0.7 - sinceHit * 0.25)}
            />
          ))}
          <text x={targetX} y={roofY - 18 - sinceHit * 10} textAnchor="middle" fontSize={20} fontWeight={900} fill="#e63946" stroke="#fff" strokeWidth={3} paintOrder="stroke" opacity={Math.max(0, 1 - sinceHit / 2)}>
            ZAPP!
          </text>
        </g>
      )}

      <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
        {charging && <ellipse cy={18} rx={10 + (t - flyIn) * 12} ry={4} fill="#b7ff5a" opacity={0.7} />}
        {/* Kuppel mit Alien */}
        <path d="M-22 -2 A22 22 0 0 1 22 -2 Z" fill="#9be7ff" stroke={INK} strokeWidth={2.5} opacity={0.9} />
        <g transform="translate(0 -9)">
          <ellipse rx={8} ry={9} fill="#7ed957" stroke={INK} strokeWidth={1.8} />
          <ellipse cx={-3.5} cy={-1} rx={3} ry={4} fill={INK} transform="rotate(-20 -3.5 -1)" />
          <ellipse cx={3.5} cy={-1} rx={3} ry={4} fill={INK} transform="rotate(20 3.5 -1)" />
          <path d="M-3 -8 L-6 -15 M3 -8 L6 -15" stroke={INK} strokeWidth={1.6} />
          <circle cx={-6} cy={-15} r={1.8} fill="#ff5fd2" />
          <circle cx={6} cy={-15} r={1.8} fill="#ff5fd2" />
        </g>
        {/* Untertasse */}
        <ellipse cy={5} rx={52} ry={14} fill="#c9d1db" stroke={INK} strokeWidth={3} />
        <ellipse cy={1} rx={40} ry={6} fill="#e9eef3" />
        <ellipse cy={13} rx={20} ry={5} fill="#7a8594" stroke={INK} strokeWidth={2} />
        {[-38, -19, 0, 19, 38].map((lx, i) => (
          <circle key={lx} cx={lx} cy={7} r={3.6} fill={(i % 2 === 0) === blink ? "#ffd166" : "#ef476f"} stroke={INK} strokeWidth={1.2} />
        ))}
      </g>
    </g>
  );
}
