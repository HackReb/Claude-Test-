import { useEffect, useMemo, useRef, useState } from "react";
import { LIFE } from "../../config/life";
import { hashString, seededRandom } from "../../game/random";
import type { LitterItem, LitterKind } from "../../model/types";

const INK = "#2b2118";
/** Figuren etwas größer als „echt“, damit man sie neben den Häusern gut sieht. */
const NPC_SCALE = 1.35;
const SKINS = ["#f1c7a3", "#d9a066", "#a86b3c", "#7a4a2a", "#ffdbac"];
const SHIRTS = ["#1982c4", "#ef476f", "#06d6a0", "#ffca3a", "#6a4c93", "#ff7a45", "#8ac926"];
const HAIR = ["#2b2118", "#6b4226", "#e0b050", "#b5533c", "#555"];

type Side = LitterItem["side"];

interface Npc {
  kind: "adult" | "kid" | "dogwalker";
  side: Side;
  x: number;
  dir: 1 | -1;
  speed: number;
  minX: number;
  maxX: number;
  phase: number;
  skin: string;
  shirt: string;
  hair: string;
  /** Wirft ab und zu Müll weg. */
  litters?: boolean;
  /** Zeitpunkt (s), an dem das nächste Ereignis passiert (Hund macht, Müll fliegt). */
  nextEventAt: number;
  /** Bis wann die Figur stehen bleibt (Hund macht gerade). */
  pausedUntil: number;
  /** Wurf in der Luft: Startzeit + Startposition. */
  toss?: { at: number; x: number };
}

export interface LifeAnchors {
  homes: number[];
  shops: number[];
  playgrounds: number[];
}

interface Props {
  seed: string;
  width: number;
  walkY: Record<Side, number>;
  anchors: LifeAnchors;
  /** Dreck landet auf dem Gehweg – nur auf der eigenen Straße. */
  onDrop?: (kind: LitterKind, spot: Pick<LitterItem, "pos" | "side">) => void;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Leute, Kinder und ein Hund auf den Gehwegen – je nachdem, was in der Straße steht. */
export function StreetLife({ seed, width, walkY, anchors, onDrop }: Props) {
  const reduced = prefersReducedMotion();
  const npcs = useMemo(() => createNpcs(seed, width, anchors), [seed, width, anchors]);
  const state = useRef<Npc[]>(npcs);
  const lastDrop = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const [, setFrame] = useState(0);

  useEffect(() => {
    state.current = npcs.map((n) => ({ ...n }));
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const npc of state.current) step(npc, dt, t);
      if (now - lastRender > 33) {
        lastRender = now;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };

    const drop = (kind: LitterKind, x: number, side: Side, t: number) => {
      if (!onDropRef.current || t - lastDrop.current < LIFE.liveLitterEverySeconds) return;
      lastDrop.current = t;
      onDropRef.current(kind, { pos: Math.min(0.97, Math.max(0.03, x / width)), side });
    };

    function step(npc: Npc, dt: number, t: number) {
      if (npc.toss && t - npc.toss.at > 0.7) {
        drop("trash", npc.toss.x + npc.dir * 26, npc.side, t);
        npc.toss = undefined;
      }
      if (t < npc.pausedUntil) {
        npc.phase += dt * 2;
        if (npc.kind === "dogwalker" && t > npc.pausedUntil - 0.3 && npc.nextEventAt < 0) {
          // Hund ist fertig → Haufen bleibt liegen
          drop("poop", npc.x + npc.dir * 20 * NPC_SCALE, npc.side, t);
          npc.nextEventAt = t + 40 + Math.random() * 40;
        }
        return;
      }
      npc.x += npc.dir * npc.speed * dt;
      npc.phase += dt * npc.speed * 0.25;
      if (npc.x > npc.maxX) {
        npc.x = npc.maxX;
        npc.dir = -1;
      } else if (npc.x < npc.minX) {
        npc.x = npc.minX;
        npc.dir = 1;
      }
      if (npc.nextEventAt > 0 && t > npc.nextEventAt) {
        if (npc.kind === "dogwalker") {
          npc.pausedUntil = t + 2.6; // Hund macht sein Geschäft
          npc.nextEventAt = -1;
        } else if (npc.litters) {
          npc.toss = { at: t, x: npc.x };
          npc.nextEventAt = t + 45 + Math.random() * 45;
        }
      }
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [npcs, reduced, width]);

  const t = performance.now() / 1000;
  return (
    <g className="street-life" aria-hidden pointerEvents="none">
      {state.current.map((npc, i) => {
        const y = walkY[npc.side];
        if (npc.kind === "dogwalker") return <DogWalker key={i} npc={npc} y={y} squatting={t < npc.pausedUntil} />;
        return (
          <g key={i}>
            <Person npc={npc} y={y} scale={npc.kind === "kid" ? 0.7 : 1} bounce={npc.kind === "kid"} />
            {npc.toss && <Toss npc={npc} y={y} t={t} />}
          </g>
        );
      })}
    </g>
  );
}

function createNpcs(seed: string, width: number, anchors: LifeAnchors): Npc[] {
  const random = seededRandom(hashString(`life:${seed}`));
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const side = (): Side => (random() < 0.5 ? "top" : "bottom");
  const now = performance.now() / 1000;
  const base = (): Omit<Npc, "kind" | "speed" | "minX" | "maxX"> => ({
    side: side(),
    x: 40 + random() * (width - 80),
    dir: random() < 0.5 ? 1 : -1,
    phase: random() * 10,
    skin: pick(SKINS),
    shirt: pick(SHIRTS),
    hair: pick(HAIR),
    nextEventAt: 0,
    pausedUntil: 0,
  });
  const npcs: Npc[] = [];
  const homes = anchors.homes.length;
  const shops = anchors.shops.length;

  // Bewohner und Kundschaft laufen die ganze Straße ab
  const adults = Math.min(3, homes) + Math.min(3, shops);
  for (let i = 0; i < Math.max(1, adults); i++) {
    const litters = shops > 0 && i >= Math.min(3, homes) && i === adults - 1;
    npcs.push({
      ...base(),
      kind: "adult",
      speed: 16 + random() * 14,
      minX: -20,
      maxX: width + 20,
      litters,
      nextEventAt: litters ? now + 20 + random() * 25 : 0,
    });
  }

  // Kinder toben vor Wohnhäusern und Spielplätzen
  const playSpots = [...anchors.playgrounds, ...anchors.playgrounds, ...anchors.homes];
  const kids = homes > 0 ? Math.min(4, homes + anchors.playgrounds.length * 2) : 0;
  for (let i = 0; i < kids; i++) {
    const center = playSpots[i % playSpots.length];
    npcs.push({ ...base(), kind: "kid", x: center, speed: 38 + random() * 20, minX: center - 70, maxX: center + 70 });
  }

  // Einer geht mit dem Hund Gassi
  if (homes > 0) {
    npcs.push({ ...base(), kind: "dogwalker", speed: 18, minX: 20, maxX: width - 20, nextEventAt: now + 15 + random() * 20 });
  }
  return npcs;
}

function Person({ npc, y, scale, bounce }: { npc: Npc; y: number; scale: number; bounce: boolean }) {
  const swing = Math.sin(npc.phase * 3) * 5;
  const hop = bounce ? -Math.abs(Math.sin(npc.phase * 3)) * 6 : 0;
  return (
    <g transform={`translate(${npc.x} ${y + hop}) scale(${npc.dir * scale * NPC_SCALE} ${scale * NPC_SCALE})`}>
      <ellipse cy={1 - hop} rx={8} ry={2.5} fill="#000" opacity={0.18} />
      <path d={`M-2 -12 L${-2 + swing} 0 M2 -12 L${2 - swing} 0`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <rect x={-6} y={-27} width={12} height={16} rx={5} fill={npc.shirt} stroke={INK} strokeWidth={1.8} />
      <path d={`M0 -23 L${6 - swing * 0.6} -14`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <circle cy={-33} r={6.5} fill={npc.skin} stroke={INK} strokeWidth={1.8} />
      <path d="M-6.5 -34 Q-6 -41 0 -40.5 Q6 -41 6.5 -34 Q3 -37 -6.5 -34 Z" fill={npc.hair} />
      <circle cx={3} cy={-33} r={1} fill={INK} />
    </g>
  );
}

function DogWalker({ npc, y, squatting }: { npc: Npc; y: number; squatting: boolean }) {
  const dogX = npc.x + npc.dir * 22 * NPC_SCALE;
  const legs = squatting ? 0 : Math.sin(npc.phase * 5) * 3;
  const wag = Math.sin(npc.phase * 9) * 20;
  return (
    <g>
      <line x1={npc.x + npc.dir * 6 * NPC_SCALE} y1={y - 16 * NPC_SCALE} x2={dogX} y2={y - 10 * NPC_SCALE} stroke={INK} strokeWidth={1.4} />
      <Person npc={npc} y={y} scale={1} bounce={false} />
      <g transform={`translate(${dogX} ${y}) scale(${npc.dir * NPC_SCALE} ${NPC_SCALE})`}>
        <ellipse cy={1} rx={10} ry={2.5} fill="#000" opacity={0.18} />
        <path d={`M-6 -4 L${-6 + legs} 0 M-3 -4 L${-3 - legs} 0 M4 -4 L${4 + legs} 0 M7 -4 L${7 - legs} 0`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        <g transform={squatting ? "translate(0 3) rotate(-12)" : undefined}>
          <ellipse cy={-8} rx={10} ry={5.5} fill="#b07a4a" stroke={INK} strokeWidth={1.8} />
          <path d={`M-9 -9 L-15 ${-14 - (squatting ? 4 : 0)}`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" transform={`rotate(${squatting ? 0 : wag} -9 -9)`} />
        </g>
        <circle cx={10} cy={-13} r={5} fill="#b07a4a" stroke={INK} strokeWidth={1.8} />
        <path d="M8 -17 Q5 -20 6 -12" fill="#7b4a2a" stroke={INK} strokeWidth={1.4} />
        <circle cx={12} cy={-14} r={1} fill={INK} />
        <circle cx={15} cy={-12} r={1.3} fill={INK} />
      </g>
    </g>
  );
}

/** Weggeworfener Müll fliegt im Bogen. */
function Toss({ npc, y, t }: { npc: Npc; y: number; t: number }) {
  const p = Math.min(1, (t - npc.toss!.at) / 0.7);
  const x = npc.toss!.x + npc.dir * 26 * p;
  const arc = -Math.sin(p * Math.PI) * 18;
  return <rect x={x - 4} y={y - 18 + 18 * p + arc} width={8} height={6} rx={2} fill="#e63946" stroke={INK} strokeWidth={1.2} transform={`rotate(${p * 360} ${x} ${y - 18 + 18 * p + arc})`} />;
}
