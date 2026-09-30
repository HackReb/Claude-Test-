import { useEffect, useState } from "react";
import { SHOWS, type ShowKind } from "../../config/streetLife";
import { CarSvg, carLength } from "../cars/CarSvg";

const INK = "#2b2118";

/** Eine Show, die gerade durch die Straße zieht (Zeiten in performance.now()-Millisekunden). */
export interface ActiveShow {
  id: number;
  kind: ShowKind;
  startedAt: number;
  /** Wo sie herkommt, wo sie hält (Eiswagen, Musiker) und wo sie verschwindet – in Straßen-Koordinaten. */
  from: number;
  spot: number;
  to: number;
  /** Dauer in Sekunden. */
  duration: number;
}

const DRIVE_SECONDS = 5;
const FIRE_DRIVE_SECONDS = 4;
const WALK_IN_SECONDS = 5;
const WALK_OUT_SECONDS = 6;

/** Wie sich eine Show bewegt: durchziehen, anhalten und weiterfahren, hinlaufen und spielen, sich treffen. */
const MOTION: Record<ShowKind, "pass" | "stop" | "walk" | "meet"> = {
  circus: "pass",
  balloon: "pass",
  wedding: "pass",
  marathon: "pass",
  icecream: "stop",
  firetruck: "stop",
  music: "walk",
  duel: "meet",
};

/** Shows auf der Fahrbahn – solange wartet der Verkehr. */
export const blocksRoad = (kind: ShowKind) => kind !== "balloon" && kind !== "music";

/** Show für den gerade sichtbaren Ausschnitt der Straße planen. */
export function planShow(id: number, kind: ShowKind, viewStart: number, viewEnd: number, startedAt: number): ActiveShow {
  const mid = (viewStart + viewEnd) / 2;
  const pass = (length: number, speed: number) => {
    const from = viewStart - 60;
    const to = viewEnd + length + 60;
    return { id, kind, startedAt, from, spot: mid, to, duration: (to - from) / speed };
  };
  switch (kind) {
    case "circus":
      return pass(SHOWS.paradeLength, SHOWS.paradeSpeed);
    case "wedding":
      return pass(SHOWS.weddingLength, SHOWS.weddingSpeed);
    case "marathon":
      return pass(SHOWS.marathonLength, SHOWS.marathonSpeed);
    case "icecream":
      return { id, kind, startedAt, from: viewStart - 160, spot: mid, to: viewEnd + 180, duration: 2 * DRIVE_SECONDS + SHOWS.icecreamStopSeconds };
    case "firetruck":
      return { id, kind, startedAt, from: viewStart - 200, spot: mid + 60, to: viewEnd + 220, duration: 2 * FIRE_DRIVE_SECONDS + SHOWS.fireStopSeconds };
    case "music":
      return { id, kind, startedAt, from: viewStart - 30, spot: mid + 30, to: viewEnd + 40, duration: WALK_IN_SECONDS + SHOWS.musicSeconds + WALK_OUT_SECONDS };
    case "balloon":
      return { id, kind, startedAt, from: viewStart - 120, spot: mid, to: viewEnd + 120, duration: SHOWS.balloonSeconds };
    case "duel":
      return { id, kind, startedAt, from: mid - 360, spot: mid, to: mid + 360, duration: SHOWS.duelSeconds };
  }
}

const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeIn = (p: number) => p * p;
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Wo die Show gerade ist und ob sie steht (Eiswagen hält, Musiker spielt, Duell läuft). */
export function showState(show: ActiveShow, now: number): { x: number; t: number; standing: boolean } {
  const t = (now - show.startedAt) / 1000;
  const motion = MOTION[show.kind];
  if (motion === "pass") return { x: show.from + (show.to - show.from) * clamp01(t / show.duration), t, standing: false };
  if (motion === "meet") return { x: show.spot, t, standing: t > DUEL.arrive && t < DUEL.bow };
  const inSeconds = motion === "walk" ? WALK_IN_SECONDS : show.kind === "firetruck" ? FIRE_DRIVE_SECONDS : DRIVE_SECONDS;
  const outSeconds = motion === "walk" ? WALK_OUT_SECONDS : inSeconds;
  const stay = show.duration - inSeconds - outSeconds;
  if (t < inSeconds) return { x: show.from + (show.spot - show.from) * easeOut(clamp01(t / inSeconds)), t, standing: false };
  if (t < inSeconds + stay) return { x: show.spot, t, standing: true };
  return { x: show.spot + (show.to - show.spot) * easeIn(clamp01((t - inSeconds - stay) / outSeconds)), t, standing: false };
}

const CHEERS: Record<ShowKind, string[]> = {
  circus: ["👏", "🤩", "😃", "🎉"],
  icecream: ["😋", "👏"],
  music: ["👏", "🎶", "😃"],
  balloon: ["☝️", "😮", "🤩"],
  firetruck: ["😮", "🐱", "👏", "🚒"],
  wedding: ["❤️", "🎉", "👋", "💐", "🥂"],
  duel: ["😲", "⚔️", "🤩", "😱"],
  marathon: ["📣", "👏", "💪", "🍌"],
};

/**
 * Worauf die Leute achten: `x` zum Hinschauen, `gather` = dort sammeln sie sich (auf der unteren
 * Straßenseite bzw. beim Duell auf ihrer eigenen), `cheers` = was sie rufen, `treat` = was es gibt.
 */
export function showFocus(
  show: ActiveShow,
  now: number,
): { x: number; gather: number | null; gatherOwnSide: boolean; cheers: string[]; treat: string | null } {
  const { x } = showState(show, now);
  const gather = show.kind === "icecream" || show.kind === "music" || show.kind === "firetruck" || show.kind === "duel" ? show.spot : null;
  return { x, gather, gatherOwnSide: show.kind === "duel", cheers: CHEERS[show.kind], treat: show.kind === "icecream" ? "🍦" : null };
}

interface Props {
  show: ActiveShow;
  /** Fahrbahn: Mitte, untere Spur (Radlinie) und unterer Gehweg (Füße). */
  roadMid: number;
  laneBottom: number;
  walkBottom: number;
}

/** Zeichnet die Show – zeitgesteuert per requestAnimationFrame. */
export function StreetShow({ show, roadMid, laneBottom, walkBottom }: Props) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      if (time - last > 33) {
        last = time;
        setNow(time);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const state = showState(show, now);
  switch (show.kind) {
    case "circus":
      return <Parade x={state.x} t={state.t} y={roadMid + 16} />;
    case "icecream":
      return <IceCreamVan x={state.x} t={state.t} y={laneBottom} standing={state.standing} />;
    case "music":
      return <Busker x={state.x} t={state.t} y={walkBottom} playing={state.standing} />;
    case "balloon":
      return <Balloon x={state.x} t={state.t} />;
    case "firetruck":
      return <FireTruck x={state.x} spot={show.spot} t={state.t} y={laneBottom} stay={state.standing ? state.t - FIRE_DRIVE_SECONDS : null} />;
    case "wedding":
      return <Wedding x={state.x} t={state.t} y={laneBottom} />;
    case "marathon":
      return <Marathon x={state.x} t={state.t} y={roadMid + 16} />;
    case "duel":
      return <Duel spot={show.spot} t={state.t} y={roadMid + 16} />;
  }
}

// ---------- Zirkus ----------

function Parade({ x, t, y }: { x: number; t: number; y: number }) {
  const step = Math.sin(t * 7);
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      <Juggler x={x - 330} y={y} t={t} />
      <Elephant x={x - 200} y={y} t={t} />
      <Clown x={x - 85} y={y} t={t} />
      <Ringmaster x={x} y={y} step={step} t={t} />
      <Confetti x={x - 160} y={y - 120} t={t} />
    </g>
  );
}

function Legs({ swing, color = INK }: { swing: number; color?: string }) {
  return <path d={`M-3 -14 L${-3 + swing * 5} 0 M3 -14 L${3 - swing * 5} 0`} stroke={color} strokeWidth={3.4} strokeLinecap="round" />;
}

function Ringmaster({ x, y, step, t }: { x: number; y: number; step: number; t: number }) {
  const baton = Math.sin(t * 6) * 35;
  return (
    <g transform={`translate(${x} ${y}) scale(1.45)`}>
      <ellipse cy={1} rx={10} ry={3} fill="#000" opacity={0.2} />
      <Legs swing={step} />
      <path d="M-8 -30 L8 -30 L10 -12 L-10 -12 Z" fill="#d62828" stroke={INK} strokeWidth={1.8} />
      <path d="M-2 -30 L0 -18 L2 -30" fill="#ffd166" stroke={INK} strokeWidth={1} />
      <g transform={`rotate(${baton} 7 -26)`}>
        <line x1={7} y1={-26} x2={20} y2={-34} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx={20} cy={-34} r={2} fill="#fff" stroke={INK} strokeWidth={1} />
      </g>
      <circle cy={-36} r={6.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.8} />
      <path d="M-4 -33 Q0 -30 4 -33" stroke={INK} strokeWidth={1.4} fill="none" />
      <circle cx={3} cy={-37} r={1} fill={INK} />
      <rect x={-6} y={-54} width={12} height={12} fill={INK} />
      <rect x={-10} y={-43} width={20} height={3} rx={1.5} fill={INK} />
      <rect x={-6} y={-47} width={12} height={2.5} fill="#d62828" />
    </g>
  );
}

function Clown({ x, y, t }: { x: number; y: number; t: number }) {
  const wobble = Math.sin(t * 5) * 8;
  const spin = (t * 400) % 360;
  return (
    <g transform={`translate(${x} ${y}) scale(1.45)`}>
      <ellipse cy={1} rx={9} ry={3} fill="#000" opacity={0.2} />
      <g transform={`rotate(${spin} 0 -9)`}>
        <circle cy={-9} r={9} fill="none" stroke={INK} strokeWidth={2.4} />
        <path d="M0 -18 L0 0 M-9 -9 L9 -9" stroke={INK} strokeWidth={1.2} />
      </g>
      <g transform={`rotate(${wobble} 0 -9)`}>
        <line x1={0} y1={-9} x2={0} y2={-28} stroke="#888" strokeWidth={2.5} />
        <rect x={-8} y={-44} width={16} height={17} rx={6} fill="#06d6a0" stroke={INK} strokeWidth={1.8} />
        <circle cx={-3} cy={-38} r={2} fill="#ffca3a" />
        <circle cx={3} cy={-33} r={2} fill="#ef476f" />
        <path d={`M-7 -40 L-16 ${-50 + wobble * 0.5} M7 -40 L16 ${-50 - wobble * 0.5}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        <circle cy={-51} r={7} fill="#fff" stroke={INK} strokeWidth={1.8} />
        <circle cx={-8} cy={-54} r={4.5} fill="#ff7a45" />
        <circle cx={8} cy={-54} r={4.5} fill="#ff7a45" />
        <circle cx={4} cy={-51} r={2.6} fill="#e63946" />
        <path d="M-4 -47 Q0 -43 4 -47" stroke="#e63946" strokeWidth={1.6} fill="none" />
        <path d="M-4 -58 L0 -68 L4 -58 Z" fill="#6a4c93" stroke={INK} strokeWidth={1.2} />
      </g>
    </g>
  );
}

function Elephant({ x, y, t }: { x: number; y: number; t: number }) {
  const step = Math.sin(t * 3.5) * 5;
  const trunk = Math.sin(t * 2.2) * 14;
  const flag = Math.sin(t * 9) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(1.45)`}>
      <ellipse cy={1} rx={42} ry={5} fill="#000" opacity={0.2} />
      {/* Beine */}
      <path
        d={`M-24 -18 L${-24 + step} 0 M-12 -18 L${-12 - step} 0 M14 -18 L${14 + step} 0 M26 -18 L${26 - step} 0`}
        stroke="#8d99ae"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <ellipse cy={-30} rx={36} ry={22} fill="#a3adbd" stroke={INK} strokeWidth={2.2} />
      {/* Decke mit Schriftzug */}
      <path d="M-20 -50 L22 -50 L26 -24 L-24 -24 Z" fill="#d62828" stroke={INK} strokeWidth={1.8} />
      <text y={-33} textAnchor="middle" fontSize={8} fontWeight={900} fill="#ffd166">
        BABONI
      </text>
      <path d="M-24 -24 L26 -24" stroke="#ffd166" strokeWidth={2} strokeDasharray="3 3" />
      {/* Kopf, Ohr, Rüssel */}
      <circle cx={34} cy={-40} r={15} fill="#a3adbd" stroke={INK} strokeWidth={2.2} />
      <ellipse cx={27} cy={-38} rx={9} ry={12} fill="#8d99ae" stroke={INK} strokeWidth={1.8} />
      <path d={`M46 -36 Q56 -24 ${52 + trunk * 0.4} ${-10 - Math.abs(trunk) * 0.5}`} stroke="#a3adbd" strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d={`M46 -36 Q56 -24 ${52 + trunk * 0.4} ${-10 - Math.abs(trunk) * 0.5}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
      <circle cx={39} cy={-45} r={1.8} fill={INK} />
      <path d="M-35 -32 Q-44 -28 -40 -18" stroke={INK} strokeWidth={1.8} fill="none" />
      {/* Reiterin mit Fähnchen */}
      <g transform="translate(0 -52)">
        <rect x={-5} y={-16} width={10} height={14} rx={4} fill="#ffca3a" stroke={INK} strokeWidth={1.5} />
        <circle cy={-21} r={5.5} fill="#ffdbac" stroke={INK} strokeWidth={1.5} />
        <path d="M-5.5 -22 Q-4 -29 0 -28 Q5 -29 5.5 -22" fill="#b5533c" />
        <line x1={4} y1={-12} x2={12} y2={-34} stroke={INK} strokeWidth={1.6} />
        <path d={`M12 -34 L${26} ${-31 + flag} L12 -26 Z`} fill="#ef476f" stroke={INK} strokeWidth={1.2} />
      </g>
    </g>
  );
}

function Juggler({ x, y, t }: { x: number; y: number; t: number }) {
  const step = Math.sin(t * 7);
  const balls = ["#ef476f", "#ffca3a", "#1982c4"].map((color, i) => {
    const p = (t * 1.3 + i / 3) % 1;
    const bx = Math.cos(p * Math.PI * 2) * 11;
    const by = -58 - Math.abs(Math.sin(p * Math.PI * 2)) * 22;
    return <circle key={color} cx={bx} cy={by} r={3.4} fill={color} stroke={INK} strokeWidth={1.2} />;
  });
  return (
    <g transform={`translate(${x} ${y}) scale(1.45)`}>
      <ellipse cy={1} rx={9} ry={3} fill="#000" opacity={0.2} />
      <Legs swing={step} />
      <rect x={-7} y={-30} width={14} height={17} rx={5} fill="#6a4c93" stroke={INK} strokeWidth={1.8} />
      <path d="M-6 -27 L-11 -40 M6 -27 L11 -40" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <circle cy={-36} r={6.5} fill="#d9a066" stroke={INK} strokeWidth={1.8} />
      <path d="M-7 -39 L0 -48 L7 -39 Z" fill="#ffca3a" stroke={INK} strokeWidth={1.2} />
      <circle cy={-48} r={2} fill="#ef476f" />
      {balls}
    </g>
  );
}

function Confetti({ x, y, t }: { x: number; y: number; t: number }) {
  const colors = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#ff7a45"];
  return (
    <g>
      {Array.from({ length: 14 }, (_, i) => {
        const p = (t * 0.6 + i * 0.137) % 1;
        const cx = x + ((i * 53) % 320) - 160 + Math.sin(t * 2 + i) * 12;
        const cy = y + p * 90;
        return <rect key={i} x={cx} y={cy} width={5} height={3} fill={colors[i % colors.length]} opacity={1 - p} transform={`rotate(${(t * 200 + i * 40) % 360} ${cx} ${cy})`} />;
      })}
    </g>
  );
}

// ---------- Eiswagen ----------

function IceCreamVan({ x, t, y, standing }: { x: number; t: number; y: number; standing: boolean }) {
  const spin = standing ? 0 : (t * 500) % 360;
  const bob = standing ? Math.sin(t * 4) * 3 : 0;
  return (
    <g className="street-show" aria-hidden pointerEvents="none" transform={`translate(${x} ${y}) scale(1.35)`}>
      <ellipse cx={0} cy={2} rx={46} ry={4} fill="#000" opacity={0.2} />
      <path d="M-44 -8 L-44 -46 Q-44 -52 -38 -52 L22 -52 Q30 -52 34 -44 L44 -24 L44 -8 Z" fill="#ffe3ef" stroke={INK} strokeWidth={2.2} />
      <path d="M-44 -22 L44 -22" stroke="#ff8fab" strokeWidth={6} />
      <rect x={-36} y={-46} width={40} height={18} rx={3} fill="#bde0fe" stroke={INK} strokeWidth={1.8} />
      {/* Eisverkäufer im Fenster */}
      <circle cx={-16} cy={-36} r={5.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.4} />
      <rect x={-22} y={-45} width={12} height={4} rx={2} fill="#fff" stroke={INK} strokeWidth={1} />
      <path d="M22 -50 L34 -26 L22 -26 Z" fill="#bde0fe" stroke={INK} strokeWidth={1.6} />
      <text x={-14} y={-12} textAnchor="middle" fontSize={10} fontWeight={900} fill="#d62828">
        EIS
      </text>
      {/* Waffel auf dem Dach */}
      <g transform={`translate(-6 ${-52 + bob})`}>
        <path d="M-7 0 L0 -14 L7 0 Z" transform="rotate(180 0 -7)" fill="#e9b872" stroke={INK} strokeWidth={1.6} />
        <circle cy={-17} r={7} fill="#ff8fab" stroke={INK} strokeWidth={1.6} />
        <circle cx={-3} cy={-22} r={5} fill="#fff1c1" stroke={INK} strokeWidth={1.4} />
        <circle cx={2} cy={-26} r={1.8} fill="#d62828" />
      </g>
      {standing && (
        <g>
          <path d="M-40 -46 L-40 -58 L8 -58 L8 -46" fill="none" stroke={INK} strokeWidth={1} />
          <path d="M-44 -46 L-36 -40 L-28 -46 L-20 -40 L-12 -46 L-4 -40 L4 -46 L12 -40" fill="#ff8fab" stroke={INK} strokeWidth={1.2} />
        </g>
      )}
      {[-26, 28].map((wx) => (
        <g key={wx} transform={`translate(${wx} -6) rotate(${spin})`}>
          <circle r={8} fill="#333" stroke={INK} strokeWidth={1.8} />
          <circle r={3.5} fill="#ddd" />
          <line x1={0} y1={-3.5} x2={0} y2={3.5} stroke="#777" strokeWidth={1} />
        </g>
      ))}
      {standing && Math.sin(t * 3) > 0 && (
        <text x={10} y={-70} textAnchor="middle" fontSize={14}>
          🔔
        </text>
      )}
    </g>
  );
}

// ---------- Straßenmusiker ----------

function Busker({ x, t, y, playing }: { x: number; t: number; y: number; playing: boolean }) {
  const step = playing ? 0 : Math.sin(t * 8);
  const strum = playing ? Math.sin(t * 12) * 6 : 0;
  const notes = playing
    ? [0, 1, 2].map((i) => {
        const p = (t * 0.5 + i / 3) % 1;
        return (
          <text key={i} x={x + 14 + Math.sin(p * 6 + i) * 10} y={y - 70 - p * 50} fontSize={16} fill="#6a4c93" opacity={1 - p}>
            {i === 1 ? "♫" : "♪"}
          </text>
        );
      })
    : null;
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      {/* Hut für Münzen – liegt da, solange er spielt */}
      {playing && (
        <g transform={`translate(${x - 34} ${y})`}>
          <ellipse rx={11} ry={4} fill="#6b4226" stroke={INK} strokeWidth={1.4} />
          <circle cx={-3} cy={-2} r={2.2} fill="#ffd166" stroke={INK} strokeWidth={0.8} />
          <circle cx={3} cy={-1.5} r={2.2} fill="#ffd166" stroke={INK} strokeWidth={0.8} />
        </g>
      )}
      {/* Läuft nach rechts; beim Spielen dreht er sich zum Hut */}
      <g transform={`translate(${x} ${y}) scale(${playing ? -1.35 : 1.35} 1.35)`}>
        <ellipse cy={1} rx={9} ry={3} fill="#000" opacity={0.2} />
        <Legs swing={step} />
        <rect x={-7} y={-30} width={14} height={17} rx={5} fill="#2a9d8f" stroke={INK} strokeWidth={1.8} />
        <circle cy={-36} r={6.5} fill="#a86b3c" stroke={INK} strokeWidth={1.8} />
        <path d="M-7 -38 Q0 -46 7 -38 Z" fill="#e0b050" stroke={INK} strokeWidth={1.2} />
        {/* Gitarre */}
        <g transform="rotate(-25 0 -20)">
          <ellipse cx={-4} cy={-18} rx={8} ry={6} fill="#c77d3a" stroke={INK} strokeWidth={1.6} />
          <circle cx={-4} cy={-18} r={2} fill={INK} />
          <rect x={3} y={-20} width={16} height={3} fill="#6b4226" stroke={INK} strokeWidth={1} />
        </g>
        <path d={`M5 -26 L${-2 + strum * 0.3} ${-19 + strum}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {notes}
    </g>
  );
}

// ---------- Heißluftballon ----------

function Balloon({ x, t }: { x: number; t: number }) {
  const y = 70 + Math.sin(t * 0.8) * 8;
  const burner = Math.sin(t * 1.3) > 0.85;
  const wave = Math.sin(t * 6) * 18;
  return (
    <g className="street-show" aria-hidden pointerEvents="none" transform={`translate(${x} ${y})`}>
      <path d="M-44 0 C-50 -64 50 -64 44 0 C40 22 16 34 12 44 L-12 44 C-16 34 -40 22 -44 0 Z" fill="#ef476f" stroke={INK} strokeWidth={2.4} />
      <path d="M-22 -44 C-30 -10 -22 30 -8 44 L8 44 C22 30 30 -10 22 -44 C12 -50 -12 -50 -22 -44 Z" fill="#ffd166" stroke={INK} strokeWidth={1.6} />
      <path d="M-6 -48 C-10 -10 -6 30 -2 44 L2 44 C6 30 10 -10 6 -48 Z" fill="#06d6a0" stroke={INK} strokeWidth={1.2} />
      <path d="M-12 44 L-9 62 M12 44 L9 62" stroke={INK} strokeWidth={1.5} />
      {burner && <path d="M-4 58 Q0 44 4 58 Z" fill="#ff7a45" />}
      <rect x={-12} y={60} width={24} height={14} rx={2} fill="#b07a4a" stroke={INK} strokeWidth={1.8} />
      <circle cx={-5} cy={56} r={4.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.2} />
      <circle cx={5} cy={56} r={4.5} fill="#d9a066" stroke={INK} strokeWidth={1.2} />
      <path d={`M9 58 L${16} ${46 - wave * 0.3}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

// ---------- Feuerwehr ----------

const LADDER = { base: { x: -22, y: -46 }, length: 118, angle: 55, scale: 1.3 } as const;

/** Wo die Katze sitzt: dort, wo die ausgefahrene Leiter hinreicht. */
function catSpot(spot: number, y: number) {
  const a = (LADDER.angle * Math.PI) / 180;
  return { x: spot + LADDER.scale * (LADDER.base.x - LADDER.length * Math.cos(a)), y: y + LADDER.scale * (LADDER.base.y - LADDER.length * Math.sin(a)) };
}

function FireTruck({ x, spot, t, y, stay }: { x: number; spot: number; t: number; y: number; stay: number | null }) {
  const stop = SHOWS.fireStopSeconds;
  const up = stay === null ? 0 : stay < 2 ? easeOut(stay / 2) : stay < stop - 2 ? 1 : 1 - easeIn((stay - (stop - 2)) / 2);
  const angle = LADDER.angle * up;
  const spin = stay !== null ? 0 : (t * 600) % 360;
  const blink = Math.floor(t * 4) % 2 === 0;
  // Feuerwehrmann klettert hoch (2–5 s), holt die Katze und fährt mit der Leiter runter.
  const climb = stay === null ? 0 : clamp01((stay - 2) / 3);
  const rescued = stay !== null ? stay > 5 : t > FIRE_DRIVE_SECONDS + stop;
  const onLadder = stay !== null && stay > 2 && stay < stop - 0.2;
  const L = LADDER.length;
  const cat = catSpot(spot, y);
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      <g transform={`translate(${x} ${y}) scale(${LADDER.scale})`}>
        <ellipse cy={2} rx={72} ry={4} fill="#000" opacity={0.2} />
        <rect x={-70} y={-44} width={108} height={36} rx={4} fill="#d62828" stroke={INK} strokeWidth={2.2} />
        <path d="M38 -8 L38 -50 L58 -50 L70 -30 L70 -8 Z" fill="#d62828" stroke={INK} strokeWidth={2.2} />
        <path d="M44 -46 L56 -46 L64 -32 L44 -32 Z" fill="#bde0fe" stroke={INK} strokeWidth={1.6} />
        <rect x={-66} y={-26} width={100} height={5} fill="#fff" />
        <text x={-16} y={-30} textAnchor="middle" fontSize={9} fontWeight={900} fill="#fff">
          FEUERWEHR 112
        </text>
        {[-58, -38, -18, 2, 22].map((sx) => (
          <rect key={sx} x={sx} y={-20} width={14} height={9} rx={1} fill="#9d0208" stroke={INK} strokeWidth={0.8} />
        ))}
        <rect x={44} y={-55} width={6} height={5} rx={1} fill={blink ? "#48cae4" : "#023e8a"} stroke={INK} strokeWidth={1} />
        <rect x={52} y={-55} width={6} height={5} rx={1} fill={blink ? "#023e8a" : "#48cae4"} stroke={INK} strokeWidth={1} />
        {blink && <circle cx={47} cy={-53} r={9} fill="#48cae4" opacity={0.35} />}
        {/* Drehleiter */}
        <g transform={`translate(${LADDER.base.x} ${LADDER.base.y}) rotate(${angle})`}>
          <line x1={0} y1={-3} x2={-L} y2={-3} stroke="#adb5bd" strokeWidth={2} />
          <line x1={0} y1={3} x2={-L} y2={3} stroke="#adb5bd" strokeWidth={2} />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={-6 - i * 10} y1={-3} x2={-6 - i * 10} y2={3} stroke="#6c757d" strokeWidth={1.4} />
          ))}
          {onLadder && (
            <g transform={`translate(${-L * climb} -6) rotate(${-angle})`}>
              <rect x={-4} y={-14} width={8} height={11} rx={3} fill="#1d3557" stroke={INK} strokeWidth={1.2} />
              <circle cy={-18} r={4.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.2} />
              <path d="M-5 -20 Q0 -27 5 -20 Z" fill="#ffd166" stroke={INK} strokeWidth={1} />
              {rescued && (
                <text x={7} y={-12} fontSize={12}>
                  🐱
                </text>
              )}
            </g>
          )}
        </g>
        <circle cx={LADDER.base.x} cy={LADDER.base.y} r={4} fill="#495057" stroke={INK} strokeWidth={1.2} />
        {[-50, 22, 54].map((wx) => (
          <g key={wx} transform={`translate(${wx} -6) rotate(${spin})`}>
            <circle r={8} fill="#333" stroke={INK} strokeWidth={1.8} />
            <circle r={3.5} fill="#ddd" />
            <line x1={0} y1={-3.5} x2={0} y2={3.5} stroke="#777" strokeWidth={1} />
          </g>
        ))}
      </g>
      {/* Die Katze: sitzt oben fest und miaut, bis sie gerettet ist – dann unten beim Wagen */}
      {!rescued && (
        <g>
          <text x={cat.x} y={cat.y} textAnchor="middle" fontSize={20}>
            🐱
          </text>
          {Math.sin(t * 2.5) > 0.2 && (
            <text x={cat.x + 22} y={cat.y - 18} textAnchor="middle" fontSize={12} fontWeight={900} fill={INK} stroke="#fff" strokeWidth={3} paintOrder="stroke">
              Miau!
            </text>
          )}
        </g>
      )}
      {rescued && stay !== null && stay > stop - 0.2 && (
        <text x={x + 90} y={y - 4} fontSize={18}>
          🐱❤️
        </text>
      )}
    </g>
  );
}

// ---------- Hochzeitskorso ----------

function Wedding({ x, t, y }: { x: number; t: number; y: number }) {
  const spin = (t * 700) % 360;
  const hop = Math.abs(Math.sin(t * 9)) * 4;
  const toot = (i: number) => Math.sin(t * 2.4 + i * 2) > 0.8;
  const followers = [
    { type: "sedan" as const, color: "#ffffff", at: -170 },
    { type: "hatch" as const, color: "#ffafcc", at: -280 },
  ];
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      {followers.map((f, i) => {
        const len = carLength(f.type);
        return (
          <g key={f.type} transform={`translate(${x + f.at - len * 1.2} ${y}) scale(1.2)`}>
            <CarSvg type={f.type} color={f.color} dir={1} spin={spin} />
            {/* Schleife auf dem Dach, Bänder zu den Spiegeln */}
            <path d={`M${len * 0.25} -30 L${len * 0.5} -38 L${len * 0.75} -30`} stroke="#fff" strokeWidth={2} fill="none" />
            <circle cx={len * 0.5} cy={-40} r={5} fill="#ff8fab" stroke={INK} strokeWidth={1.2} />
            {toot(i) && (
              <text x={len * 0.5} y={-52} textAnchor="middle" fontSize={11} fontWeight={900} fill="#d62828" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                TÜT TÜT!
              </text>
            )}
          </g>
        );
      })}
      {/* Blechdosen an Schnüren */}
      {[0, 1, 2].map((i) => {
        const cx = x - 120 - 16 - i * 13;
        const cy = y - 4 - Math.abs(Math.sin(t * 11 + i * 1.7)) * 6;
        return (
          <g key={i}>
            <line x1={x - 126} y1={y - 14} x2={cx} y2={cy - 3} stroke={INK} strokeWidth={0.8} />
            <rect x={cx - 4} y={cy - 6} width={8} height={9} rx={1.5} fill="#adb5bd" stroke={INK} strokeWidth={1} transform={`rotate(${Math.sin(t * 13 + i) * 30} ${cx} ${cy})`} />
          </g>
        );
      })}
      {/* Cabrio mit Brautpaar */}
      <g transform={`translate(${x - 120} ${y}) scale(1.2)`}>
        <ellipse cx={50} cy={2} rx={52} ry={4} fill="#000" opacity={0.2} />
        <path d="M2 -8 L2 -26 Q2 -32 10 -32 L78 -32 Q92 -32 98 -22 L100 -8 Z" fill="#fff" stroke={INK} strokeWidth={2.2} />
        <path d="M2 -22 L100 -22" stroke="#ff8fab" strokeWidth={3} />
        <path d="M64 -32 L72 -46" stroke={INK} strokeWidth={2.2} />
        <path d="M64 -32 L70 -44 L76 -32 Z" fill="#bde0fe" opacity={0.7} />
        {/* Bräutigam am Steuer, Braut winkt mit dem Strauß */}
        <g transform={`translate(52 ${-34 - hop * 0.3})`}>
          <rect x={-5} y={-8} width={10} height={10} rx={3} fill="#212529" />
          <circle cy={-13} r={5.5} fill="#d9a066" stroke={INK} strokeWidth={1.3} />
          <rect x={-5} y={-25} width={10} height={9} fill="#212529" />
          <rect x={-8} y={-17} width={16} height={2.5} fill="#212529" />
        </g>
        <g transform={`translate(30 ${-34 - hop * 0.3})`}>
          <path d="M-7 2 L-4 -9 L4 -9 L7 2 Z" fill="#fff" stroke={INK} strokeWidth={1.2} />
          <path d="M-8 -12 Q0 -24 8 -12 L10 4 L-10 4 Z" fill="#f8f9fa" opacity={0.85} stroke="#dee2e6" strokeWidth={1} />
          <circle cy={-13} r={5.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.3} />
          <path d={`M-4 -8 L${-12} ${-22 + Math.sin(t * 8) * 4}`} stroke="#f1c7a3" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={-12} cy={-24 + Math.sin(t * 8) * 4} r={4} fill="#ff8fab" stroke={INK} strokeWidth={1} />
        </g>
        <rect x={-18} y={-26} width={22} height={11} rx={2} fill="#fff" stroke={INK} strokeWidth={1.2} />
        <text x={-7} y={-18} textAnchor="middle" fontSize={4.6} fontWeight={900} fill="#d62828">
          JUST
        </text>
        <text x={-7} y={-13.5} textAnchor="middle" fontSize={4.6} fontWeight={900} fill="#d62828">
          MARRIED
        </text>
        {[22, 80].map((wx) => (
          <g key={wx} transform={`translate(${wx} -6) rotate(${spin})`}>
            <circle r={7.5} fill="#333" stroke={INK} strokeWidth={1.8} />
            <circle r={3.2} fill="#ddd" />
            <line x1={0} y1={-3.2} x2={0} y2={3.2} stroke="#777" strokeWidth={1} />
          </g>
        ))}
      </g>
      {/* Herzen steigen auf */}
      {Array.from({ length: 6 }, (_, i) => {
        const p = (t * 0.7 + i / 6) % 1;
        return (
          <text key={i} x={x - 70 - i * 18 + Math.sin(t * 3 + i) * 8} y={y - 60 - p * 70} fontSize={12 + (i % 3) * 3} opacity={1 - p} fill="#ef476f">
            ❤
          </text>
        );
      })}
    </g>
  );
}

// ---------- Stadtlauf ----------

const RUNNERS = [
  { at: 0, shirt: "#1982c4", skin: "#d9a066", bib: 7 },
  { at: -60, shirt: "#ef476f", skin: "#f1c7a3", bib: 23 },
  { at: -130, shirt: "#06d6a0", skin: "#7a4a2a", bib: 42 },
  { at: -190, banana: true },
  { at: -260, shirt: "#6a4c93", skin: "#ffdbac", bib: 101 },
  { at: -320, shirt: "#ff7a45", skin: "#a86b3c", bib: 99 },
] as const;

function Marathon({ x, t, y }: { x: number; t: number; y: number }) {
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      {RUNNERS.map((r, i) => {
        const phase = t * 11 + i * 1.3;
        const swing = Math.sin(phase);
        const bob = -Math.abs(Math.cos(phase)) * 5;
        const rx = x + r.at + Math.sin(t * 0.8 + i) * 10;
        if ("banana" in r) {
          return (
            <g key={i} transform={`translate(${rx} ${y + bob}) scale(1.45)`}>
              <ellipse cy={1 - bob} rx={9} ry={3} fill="#000" opacity={0.2} />
              <Legs swing={swing} />
              <path d="M-6 -12 Q-14 -34 -2 -54 Q2 -58 5 -54 Q-4 -34 8 -12 Z" fill="#ffd60a" stroke={INK} strokeWidth={1.8} />
              <path d="M-2 -54 L0 -60" stroke="#6b4226" strokeWidth={2.4} strokeLinecap="round" />
              <circle cx={1} cy={-36} r={5} fill="#f1c7a3" stroke={INK} strokeWidth={1.2} />
              <circle cx={3} cy={-37} r={0.9} fill={INK} />
              <path d="M0 -33 Q2 -31 4 -33" stroke={INK} strokeWidth={1} fill="none" />
              <path d={`M-5 -28 L${-11 - swing * 4} -20 M5 -28 L${11 + swing * 4} -20`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        }
        return (
          <g key={i} transform={`translate(${rx} ${y + bob}) scale(1.45)`}>
            <ellipse cy={1 - bob} rx={9} ry={3} fill="#000" opacity={0.2} />
            <Legs swing={swing} />
            <rect x={-6} y={-29} width={12} height={16} rx={5} fill={r.shirt} stroke={INK} strokeWidth={1.8} />
            <rect x={-4.5} y={-25} width={9} height={7} fill="#fff" stroke={INK} strokeWidth={0.8} />
            <text y={-19.5} textAnchor="middle" fontSize={5} fontWeight={900} fill={INK}>
              {r.bib}
            </text>
            <path d={`M-5 -26 L${-9 - swing * 5} -18 M5 -26 L${9 + swing * 5} -20`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
            <circle cy={-35} r={6.5} fill={r.skin} stroke={INK} strokeWidth={1.8} />
            <rect x={-6.5} y={-40} width={13} height={3} fill="#fff" stroke={INK} strokeWidth={0.8} />
            <circle cx={3} cy={-35} r={1} fill={INK} />
          </g>
        );
      })}
    </g>
  );
}

// ---------- Lichtschwertduell ----------

/** Zeitplan in Sekunden: ankommen, kämpfen, verbeugen, gehen. */
export const DUEL = { ignite: 2.3, arrive: 3, bow: 15, retract: 15.2, leave: 17, swing: 7 } as const;

/** Zeitpunkte, an denen die Klingen zusammenkrachen (für Funken und Sound). */
export function duelClashes(): number[] {
  const times: number[] = [];
  for (let k = 0; ; k++) {
    const at = (Math.PI / 2 + 2 * Math.PI * k) / DUEL.swing;
    if (at >= DUEL.bow) return times;
    if (at > DUEL.arrive) times.push(at);
  }
}

function Duel({ spot, t, y }: { spot: number; t: number; y: number }) {
  const reach = 50;
  const far = 360;
  const off =
    t < DUEL.arrive
      ? reach + (far - reach) * (1 - easeOut(clamp01(t / DUEL.arrive)))
      : t < DUEL.leave
        ? reach
        : reach + (far - reach) * easeIn(clamp01((t - DUEL.leave) / (SHOWS.duelSeconds - DUEL.leave)));
  const walking = t < DUEL.arrive || t > DUEL.leave;
  const fighting = t > DUEL.arrive && t < DUEL.bow;
  const blade = t < DUEL.ignite ? 0 : t < DUEL.ignite + 0.4 ? (t - DUEL.ignite) / 0.4 : t < DUEL.retract ? 1 : Math.max(0, 1 - (t - DUEL.retract) / 0.4);
  const swing = Math.sin(t * DUEL.swing);
  const angle = fighting ? 45 + swing * 42 : 20;
  const lunge = fighting ? Math.sin(t * 2.3) * 8 : 0;
  const bowing = t > DUEL.bow && t < DUEL.leave;
  // Der Helle springt ab und zu über den Schlag hinweg.
  const cycle = (t - DUEL.arrive) % 4.5;
  const jump = fighting && cycle > 3.3 ? -Math.sin(((cycle - 3.3) / 1.2) * Math.PI) * 38 : 0;
  const clash = fighting && swing > 0.9;
  return (
    <g className="street-show" aria-hidden pointerEvents="none">
      <Knight x={spot - off + lunge} y={y} dir={1} robe="#212529" saber="#ff2e2e" angle={angle} blade={blade} walking={walking} t={t} bowing={bowing} jump={0} />
      <Knight x={spot + off + lunge} y={y} dir={-1} robe="#b08968" saber="#4cc9f0" angle={angle} blade={blade} walking={walking} t={t} bowing={bowing} jump={jump} />
      {clash && (
        <g transform={`translate(${spot + lunge} ${y - 42})`}>
          <path d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z" fill="#fff" stroke="#ffd166" strokeWidth={2} />
          <circle r={18} fill="#fff" opacity={0.35} />
        </g>
      )}
    </g>
  );
}

function Knight({
  x,
  y,
  dir,
  robe,
  saber,
  angle,
  blade,
  walking,
  t,
  bowing,
  jump,
}: {
  x: number;
  y: number;
  dir: 1 | -1;
  robe: string;
  saber: string;
  angle: number;
  blade: number;
  walking: boolean;
  t: number;
  bowing: boolean;
  jump: number;
}) {
  const step = walking ? Math.sin(t * 8) : 0;
  const len = 34 * blade;
  return (
    <g transform={`translate(${x} ${y + jump}) scale(${dir * 1.75} 1.75)`}>
      <ellipse cy={1 - jump / 1.75} rx={10} ry={3} fill="#000" opacity={0.2} />
      <g transform={bowing ? "rotate(28 0 -12)" : undefined}>
        <Legs swing={step} />
        <path d="M-9 -8 L-6 -32 L6 -32 L9 -8 Z" fill={robe} stroke={INK} strokeWidth={1.8} />
        <path d="M-7 -30 Q0 -48 7 -30 Z" fill={robe} stroke={INK} strokeWidth={1.8} />
        <circle cx={1} cy={-35} r={4.5} fill="#f1c7a3" stroke={INK} strokeWidth={1.2} />
        <circle cx={3} cy={-35.5} r={0.9} fill={INK} />
        <path d="M-7 -33 Q0 -46 7 -33 Q4 -40 0 -41 Q-4 -40 -7 -33 Z" fill={robe} stroke={INK} strokeWidth={1.2} />
        {/* Schwert: Griff in der Hand, Klinge leuchtet */}
        <g transform={`translate(7 -22) rotate(${angle})`}>
          <path d="M-6 6 L0 0" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <rect x={-2} y={-2} width={4} height={9} rx={1} fill="#adb5bd" stroke={INK} strokeWidth={1} />
          {len > 0 && (
            <g>
              <line x1={0} y1={-2} x2={0} y2={-2 - len} stroke={saber} strokeWidth={6} strokeLinecap="round" opacity={0.45} />
              <line x1={0} y1={-2} x2={0} y2={-2 - len} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}
