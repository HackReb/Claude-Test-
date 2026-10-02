import { useEffect, useMemo, useRef, useState } from "react";
import { hashString, seededRandom } from "../../game/random";
import type { MemberSummary } from "../model/types";

const INK = "#2b2118";
const SCALE = 1.4;
const SKINS = ["#f1c7a3", "#d9a066", "#a86b3c", "#7a4a2a", "#ffdbac"];
const SHIRTS = ["#1982c4", "#ef476f", "#06d6a0", "#ffca3a", "#6a4c93", "#ff7a45", "#8ac926"];
const HAIR = ["#2b2118", "#6b4226", "#e0b050", "#b5533c", "#555"];
const TAGS = ["#ff7a45", "#1982c4", "#06d6a0", "#6a4c93", "#ef476f", "#118ab2"];

interface Walker {
  member: MemberSummary;
  x: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  side: "top" | "bottom";
  pauseUntil: number;
  skin: string;
  shirt: string;
  hair: string;
  tag: string;
}

interface Props {
  members: MemberSummary[];
  width: number;
  walkY: { top: number; bottom: number };
  meId: string | null;
  onTap?: (member: MemberSummary) => void;
}

/** Die Spieler der Straße als Figuren – mit Namen über dem Kopf, damit man sie von den Bewohnern unterscheidet. */
export function MemberWalkers({ members, width, walkY, meId, onTap }: Props) {
  const walkers = useMemo(() => members.map((m) => createWalker(m, width)), [members, width]);
  const state = useRef<Walker[]>(walkers);
  const [, setFrame] = useState(0);

  useEffect(() => {
    const before = new Map(state.current.map((w) => [w.member.id, w]));
    state.current = walkers.map((w) => before.get(w.member.id) ?? w);
  }, [walkers]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const w of state.current) {
        if (t < w.pauseUntil) continue;
        w.x += w.dir * w.speed * dt;
        w.phase += dt * w.speed * 0.25;
        if (w.x > width - 30) w.dir = -1;
        else if (w.x < 30) w.dir = 1;
        if (Math.random() < dt * 0.05) w.pauseUntil = t + 1.5 + Math.random() * 3;
      }
      if (now - lastRender > 33) {
        lastRender = now;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width]);

  return (
    <g className="member-walkers">
      {state.current.map((w) => {
        const y = walkY[w.side];
        const swing = Math.sin(w.phase * 3) * 5;
        const me = w.member.id === meId;
        const label = w.member.name.length > 14 ? `${w.member.name.slice(0, 13)}…` : w.member.name;
        const tagWidth = label.length * 6.4 + 14;
        return (
          <g
            key={w.member.id}
            role={onTap ? "button" : undefined}
            tabIndex={onTap ? 0 : undefined}
            aria-label={`Spieler ${w.member.name}`}
            style={onTap ? { cursor: "pointer" } : undefined}
            onClick={onTap ? () => onTap(w.member) : undefined}
          >
            <g transform={`translate(${w.x} ${y}) scale(${w.dir * SCALE} ${SCALE})`}>
              <ellipse cy={1} rx={8} ry={2.5} fill="#000" opacity={0.18} />
              <path d={`M-2 -12 L${-2 + swing} 0 M2 -12 L${2 - swing} 0`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
              <rect x={-6} y={-27} width={12} height={16} rx={5} fill={w.shirt} stroke={INK} strokeWidth={1.8} />
              <path d={`M0 -23 L${6 - swing * 0.6} -14`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
              <circle cy={-33} r={6.5} fill={w.skin} stroke={INK} strokeWidth={1.8} />
              <path d="M-6.5 -34 Q-6 -41 0 -40.5 Q6 -41 6.5 -34 Q3 -37 -6.5 -34 Z" fill={w.hair} />
              <circle cx={3} cy={-33} r={1} fill={INK} />
            </g>
            {/* Namensschild */}
            <g transform={`translate(${w.x} ${y - 66})`}>
              <rect x={-tagWidth / 2} y={-9} width={tagWidth} height={16} rx={8} fill={me ? "#ffd166" : w.tag} stroke={INK} strokeWidth={1.5} />
              <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={900} fill={me ? INK : "#fff"}>
                {label}
              </text>
              <path d="M-4 7 L0 12 L4 7 Z" fill={me ? "#ffd166" : w.tag} stroke={INK} strokeWidth={1} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function createWalker(member: MemberSummary, width: number): Walker {
  const random = seededRandom(hashString(`member:${member.id}`));
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  return {
    member,
    x: 40 + random() * Math.max(1, width - 80),
    dir: random() < 0.5 ? 1 : -1,
    speed: 18 + random() * 12,
    phase: random() * 10,
    side: random() < 0.5 ? "top" : "bottom",
    pauseUntil: 0,
    skin: pick(SKINS),
    shirt: pick(SHIRTS),
    hair: pick(HAIR),
    tag: pick(TAGS),
  };
}
