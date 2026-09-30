import { useEffect, useMemo, useRef, useState } from "react";
import { LIFE } from "../../config/life";
import { STREET_LIFE } from "../../config/streetLife";
import { hashString, seededRandom } from "../../game/random";
import type { LitterItem, LitterKind } from "../../model/types";
import { showFocus, type ActiveShow } from "./StreetShows";

const INK = "#2b2118";
/** Figuren etwas größer als „echt“, damit man sie neben den Häusern gut sieht. */
const NPC_SCALE = 1.35;
const SKINS = ["#f1c7a3", "#d9a066", "#a86b3c", "#7a4a2a", "#ffdbac"];
const SHIRTS = ["#1982c4", "#ef476f", "#06d6a0", "#ffca3a", "#6a4c93", "#ff7a45", "#8ac926"];
const HAIR = ["#2b2118", "#6b4226", "#e0b050", "#b5533c", "#555"];
const CHAT = ["💬", "😄", "👋", "☕", "🤣", "🙂", "🗞️"];

type Side = LitterItem["side"];

/** Ein Wohnhaus mit seinen Bewohnern, ein Laden oder ein Spielplatz – Mitte, halbe Breite, Straßenseite. */
export interface LifeSpot {
  id: string;
  x: number;
  half: number;
  side: Side;
}
export interface LifeHome extends LifeSpot {
  residents: number;
}
export interface LifeAnchors {
  homes: LifeHome[];
  shops: LifeSpot[];
  playgrounds: LifeSpot[];
}

type Mode = "hang" | "walk" | "inside" | "stroll" | "watch";
type Arrival = "shop" | "home" | "visit" | "play" | "watch";

interface Npc {
  id: string;
  kind: "adult" | "kid";
  home: LifeHome;
  x: number;
  y: number;
  side: Side;
  dir: 1 | -1;
  speed: number;
  phase: number;
  skin: string;
  shirt: string;
  hair: string;
  mode: Mode;
  /** Bis wann der aktuelle Zustand dauert (s) – vor dem Haus stehen, drinnen sein. */
  until: number;
  /** Wegpunkte beim Gehen und was bei der Ankunft passiert. */
  path: { x: number; y: number; side: Side }[];
  arrive: Arrival | null;
  /** Wo jemand gerade herumsteht (vor dem eigenen Haus, beim Nachbarn, am Spielplatz). */
  area: LifeSpot;
  /** Wohin er beim Herumstehen gerade schlendert. */
  wander: number | null;
  /** Kommt aus einem Laden: Einkaufstüte bis nach Hause. */
  bag: boolean;
  /** Geht mit dem Hund Gassi (läuft die ganze Straße ab). */
  dog: boolean;
  /** Wirft ab und zu Müll weg. */
  litters: boolean;
  emote: { text: string; until: number } | null;
  /** Welche Show er schon anschaut. */
  watching: number | null;
  /** Hund macht / Müll fliegt. */
  nextEventAt: number;
  pausedUntil: number;
  toss?: { at: number; x: number };
}

interface Props {
  seed: string;
  width: number;
  walkY: Record<Side, number>;
  anchors: LifeAnchors;
  /** Dreck landet auf dem Gehweg – nur auf der eigenen Straße. */
  onDrop?: (kind: LitterKind, spot: Pick<LitterItem, "pos" | "side">) => void;
  /** Aliens über der Straße (x des Ziels): alle rennen panisch davon. */
  panicX?: number | null;
  /** Show auf der Straße (Zirkus, Eiswagen …): die Leute schauen zu. */
  show?: ActiveShow | null;
}

/** So viel schneller rennen alle, wenn das UFO kommt. */
const PANIC_SPEED = 4.5;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const between = (range: readonly [number, number] | readonly number[], r = Math.random()) => range[0] + r * (range[1] - range[0]);

/**
 * Wie viele Figuren zu welchem Haus gehören: zusammen so viele, wie in der Straße wohnen (gerundet wie die
 * Anzeige 👥), bei sehr vielen Bewohnern höchstens `max` – der Rest ist gerade zuhause.
 */
export function allocateWalkers(homes: { id: string; residents: number }[], max: number): Record<string, number> {
  const exact = homes.map((h) => ({ id: h.id, value: Math.max(0, h.residents) }));
  const total = exact.reduce((sum, h) => sum + h.value, 0);
  const target = Math.min(max, Math.round(total));
  const result: Record<string, number> = {};
  if (total === 0) return Object.fromEntries(homes.map((h) => [h.id, 0]));
  const shares = exact.map((h) => ({ id: h.id, share: (h.value * target) / total }));
  let given = 0;
  for (const s of shares) given += result[s.id] = Math.floor(s.share);
  for (const s of [...shares].sort((a, b) => b.share - Math.floor(b.share) - (a.share - Math.floor(a.share)))) {
    if (given >= target) break;
    result[s.id]++;
    given++;
  }
  return result;
}

/** Die Bewohner der Straße: stehen vor ihren Häusern, gehen einkaufen, besuchen Nachbarn, schauen Shows. */
export function StreetLife({ seed, width, walkY, anchors, onDrop, panicX = null, show = null }: Props) {
  const reduced = prefersReducedMotion();
  const npcs = useMemo(() => createNpcs(seed, width, anchors, walkY), [seed, width, anchors, walkY]);
  const state = useRef<Npc[]>(npcs);
  const lastDrop = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const panicRef = useRef(panicX);
  panicRef.current = panicX;
  const showRef = useRef(show);
  showRef.current = show;
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const [, setFrame] = useState(0);

  // Neue Liste (jemand zieht ein oder aus): wer schon da war, bleibt, wo er ist; Neue kommen aus der Haustür.
  const known = useRef(false);
  useEffect(() => {
    const before = new Map(state.current.map((n) => [n.id, n]));
    const now = performance.now() / 1000;
    state.current = npcs.map((n) => {
      const old = known.current ? before.get(n.id) : undefined;
      if (old) return { ...old, home: n.home, area: old.area.id === old.home.id ? n.home : old.area };
      if (!known.current) return { ...n };
      return { ...n, mode: "inside" as const, until: now + Math.random() * 3, x: n.home.x, y: walkY[n.home.side], side: n.home.side };
    });
    known.current = true;
  }, [npcs, walkY]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const current = showRef.current;
      const focus = current ? showFocus(current, now) : null;
      for (const npc of state.current) step(npc, dt, t, focus && current ? { ...focus, id: current.id } : null);
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

    /** Weg dorthin – auf die andere Straßenseite geht es quer über die Fahrbahn. */
    const goTo = (npc: Npc, x: number, side: Side, arrive: Arrival) => {
      const path: Npc["path"] = [];
      if (side !== npc.side) {
        const cross = npc.x + (x > npc.x ? 24 : -24);
        path.push({ x: cross, y: walkY[side], side });
      }
      path.push({ x, y: walkY[side], side });
      npc.path = path;
      npc.arrive = arrive;
      npc.mode = "walk";
    };

    const say = (npc: Npc, options: string[], t: number, seconds = 2.5) => {
      npc.emote = { text: options[Math.floor(Math.random() * options.length)], until: t + seconds };
    };

    /** Was als Nächstes? Einkaufen, heimgehen, Nachbarn besuchen, spielen … */
    const plan = (npc: Npc, t: number) => {
      const { shops, homes, playgrounds } = anchorsRef.current;
      const r = Math.random();
      // Unterwegs (Nachbar, Spielplatz): erst mal wieder nach Hause.
      if (npc.area.id !== npc.home.id) return goTo(npc, npc.home.x + between([-0.5, 0.5]) * npc.home.half, npc.home.side, "home");
      if (npc.kind === "kid") {
        if (playgrounds.length > 0 && r < 0.5) {
          const spot = playgrounds[Math.floor(Math.random() * playgrounds.length)];
          return goTo(npc, spot.x, spot.side, "play");
        }
        if (r < 0.7) return goInside(npc, t, STREET_LIFE.homeSeconds);
        return hang(npc, t);
      }
      const { shop, home, visit } = STREET_LIFE.chances;
      if (shops.length > 0 && r < shop) {
        const target = shops[Math.floor(Math.random() * shops.length)];
        return goTo(npc, target.x, target.side, "shop");
      }
      if (r < shop + home) return goInside(npc, t, STREET_LIFE.homeSeconds);
      const neighbors = homes.filter((h) => h.id !== npc.home.id);
      if (neighbors.length > 0 && r < shop + home + visit) {
        const target = neighbors[Math.floor(Math.random() * neighbors.length)];
        npc.area = target;
        return goTo(npc, target.x + between([-0.5, 0.5]) * target.half, target.side, "visit");
      }
      hang(npc, t);
      say(npc, CHAT, t);
    };

    const hang = (npc: Npc, t: number, seconds: readonly number[] = STREET_LIFE.hangSeconds) => {
      npc.mode = "hang";
      npc.until = t + between(seconds);
      npc.wander = null;
    };

    const goInside = (npc: Npc, t: number, seconds: readonly number[]) => {
      npc.mode = "inside";
      npc.until = t + between(seconds);
      npc.emote = null;
    };

    const arrived = (npc: Npc, t: number) => {
      const what = npc.arrive;
      npc.arrive = null;
      switch (what) {
        case "shop":
          // Rein in den Laden – und nachher an derselben Tür wieder raus.
          npc.area = { id: `shop@${Math.round(npc.x)}`, x: npc.x, half: 0, side: npc.side };
          goInside(npc, t, STREET_LIFE.shopSeconds);
          npc.bag = true;
          return;
        case "home":
          npc.area = npc.home;
          if (npc.bag) {
            npc.bag = false;
            return goInside(npc, t, STREET_LIFE.homeSeconds);
          }
          return hang(npc, t);
        case "visit":
          hang(npc, t, [8, 14]);
          return say(npc, CHAT, t, 3);
        case "play": {
          const spot = anchorsRef.current.playgrounds.find((p) => Math.abs(p.x - npc.x) < 2) ?? npc.home;
          npc.area = spot;
          return hang(npc, t, [10, 20]);
        }
        case "watch":
          npc.mode = "watch";
          return;
        default:
          hang(npc, t);
      }
    };

    function walk(npc: Npc, dt: number, speed: number): boolean {
      const target = npc.path[0];
      if (!target) return true;
      const dx = target.x - npc.x;
      const dy = target.y - npc.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = speed * dt;
      if (Math.abs(dx) > 0.5) npc.dir = dx > 0 ? 1 : -1;
      npc.phase += dt * speed * 0.25;
      if (dist <= stepLen) {
        npc.x = target.x;
        npc.y = target.y;
        npc.side = target.side;
        npc.path.shift();
        return npc.path.length === 0;
      }
      npc.x += (dx / dist) * stepLen;
      npc.y += (dy / dist) * stepLen;
      return false;
    }

    function step(npc: Npc, dt: number, t: number, focus: (ReturnType<typeof showFocus> & { id: number }) | null) {
      if (npc.emote && t > npc.emote.until) npc.emote = null;

      const panic = panicRef.current;
      if (panic !== null) {
        if (npc.mode === "inside") return; // drinnen ist man sicher
        // Weg vom UFO, so schnell es geht – auch über den Straßenrand hinaus.
        npc.dir = npc.x < panic ? -1 : 1;
        npc.x += npc.dir * npc.speed * PANIC_SPEED * dt;
        npc.y += (walkY[npc.side] - npc.y) * Math.min(1, dt * 4);
        npc.phase += dt * npc.speed * 0.9;
        npc.toss = undefined;
        npc.pausedUntil = 0;
        npc.path = [];
        npc.arrive = null;
        npc.mode = "hang";
        npc.until = t + between([3, 8]);
        return;
      }
      // Nach der Flucht (oder wenn jemand weit weg ist): zurück nach Hause.
      if (npc.mode === "hang" && (npc.x < -10 || npc.x > width + 10)) {
        npc.area = npc.home;
        goTo(npc, npc.home.x, npc.home.side, "home");
      }

      // Show: alle, die draußen sind, gehen hin bzw. schauen zu.
      if (focus && npc.mode !== "inside" && !npc.dog && npc.watching !== focus.id) {
        npc.watching = focus.id;
        npc.emote = null;
        if (focus.gather !== null) {
          // Bei Eiswagen, Musiker, Feuerwehr und Duell sammeln sich die Leute – Kinder vorne dran.
          const gap = npc.kind === "kid" ? 22 + Math.random() * 30 : 45 + Math.random() * 80;
          goTo(npc, focus.gather + (Math.random() < 0.5 ? -1 : 1) * gap, focus.gatherOwnSide ? npc.side : "bottom", "watch");
        } else {
          // Zuschauen vom nächsten Gehweg aus – niemand bleibt auf der Fahrbahn stehen.
          const side: Side = npc.y < (walkY.top + walkY.bottom) / 2 ? "top" : "bottom";
          npc.path = [{ x: npc.x, y: walkY[side], side }];
          npc.arrive = "watch";
          npc.mode = "walk";
        }
      }
      if (!focus && npc.watching !== null) {
        npc.watching = null;
        npc.emote = null;
        if (npc.mode === "watch" || npc.arrive === "watch") {
          npc.area = npc.home;
          goTo(npc, npc.home.x + between([-0.5, 0.5]) * npc.home.half, npc.home.side, "home");
        }
      }

      if (npc.toss && t - npc.toss.at > 0.7) {
        drop("trash", npc.toss.x + npc.dir * 26, npc.side, t);
        npc.toss = undefined;
      }

      switch (npc.mode) {
        case "inside":
          if (t > npc.until) {
            npc.x = npc.area.x;
            npc.y = walkY[npc.area.side];
            npc.side = npc.area.side;
            if (npc.bag) {
              // Aus dem Laden: mit Tüte nach Hause (und manch einer lässt die Verpackung fallen).
              if (npc.litters && t > npc.nextEventAt) {
                npc.toss = { at: t + 1.5, x: npc.x };
                npc.nextEventAt = t + 45 + Math.random() * 45;
              }
              npc.area = npc.home;
              goTo(npc, npc.home.x + between([-0.4, 0.4]) * npc.home.half, npc.home.side, "home");
            } else hang(npc, t);
          }
          return;
        case "walk": {
          const speed = npc.arrive === "watch" && npc.kind === "kid" ? npc.speed * 1.6 : npc.speed;
          if (walk(npc, dt, speed)) arrived(npc, t);
          return;
        }
        case "watch":
          if (focus) {
            npc.dir = focus.x > npc.x ? 1 : -1;
            // Am Eiswagen: nach kurzem Anstehen hat jeder sein Eis.
            if (focus.treat && npc.emote?.text !== focus.treat && Math.random() < dt * 0.5) npc.emote = { text: focus.treat, until: t + 120 };
            if (!npc.emote && Math.random() < dt * 0.25) say(npc, focus.cheers, t, 1.8);
            npc.phase += npc.kind === "kid" ? dt * 3 : 0;
          }
          return;
        case "stroll":
          strollWithDog(npc, dt, t);
          return;
        case "hang": {
          if (t > npc.until) return plan(npc, t);
          const area = npc.area;
          if (npc.wander === null || Math.abs(npc.wander - npc.x) < 1) {
            // Kurz stehen bleiben, dann ein paar Schritte vor dem Haus hin und her.
            if (npc.wander !== null) npc.pausedUntil = t + between(npc.kind === "kid" ? [0.2, 0.8] : [1, 4]);
            npc.wander = area.x + (Math.random() * 2 - 1) * Math.max(10, area.half * (npc.kind === "kid" ? 0.9 : 0.6));
          }
          if (t < npc.pausedUntil) {
            if (!npc.emote && npc.kind === "adult" && Math.random() < dt * 0.04) say(npc, CHAT, t);
            return;
          }
          const dx = npc.wander - npc.x;
          const speed = npc.kind === "kid" ? npc.speed : npc.speed * 0.4;
          npc.dir = dx > 0 ? 1 : -1;
          npc.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
          npc.y += (walkY[npc.side] - npc.y) * Math.min(1, dt * 4);
          npc.phase += dt * speed * 0.25;
          return;
        }
      }
    }

    function strollWithDog(npc: Npc, dt: number, t: number) {
      if (t < npc.pausedUntil) {
        npc.phase += dt * 2;
        if (t > npc.pausedUntil - 0.3 && npc.nextEventAt < 0) {
          // Hund ist fertig → Haufen bleibt liegen
          drop("poop", npc.x + npc.dir * 20 * NPC_SCALE, npc.side, t);
          npc.nextEventAt = t + 40 + Math.random() * 40;
        }
        return;
      }
      npc.x += npc.dir * npc.speed * dt;
      npc.y += (walkY[npc.side] - npc.y) * Math.min(1, dt * 4);
      npc.phase += dt * npc.speed * 0.25;
      if (npc.x > width - 20) npc.dir = -1;
      else if (npc.x < 20) npc.dir = 1;
      if (npc.nextEventAt > 0 && t > npc.nextEventAt) {
        npc.pausedUntil = t + 2.6; // Hund macht sein Geschäft
        npc.nextEventAt = -1;
      }
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, width, walkY]);

  const t = performance.now() / 1000;
  return (
    <g className="street-life" aria-hidden pointerEvents="none">
      {state.current.map((npc) => {
        if (npc.mode === "inside") return null;
        const y = npc.y;
        const scale = npc.kind === "kid" ? 0.7 : 1;
        const bubble = panicX !== null ? (npc.id.length % 3 === 0 ? "😱" : npc.id.length % 3 === 1 ? "AAAH!" : "😨") : npc.emote?.text;
        return (
          <g key={npc.id}>
            {npc.dog ? (
              <DogWalker npc={npc} y={y} squatting={t < npc.pausedUntil} />
            ) : (
              <Person npc={npc} y={y} scale={scale} bounce={npc.kind === "kid" || panicX !== null || (npc.mode === "watch" && !!npc.emote)} />
            )}
            {npc.toss && t > npc.toss.at && <Toss npc={npc} y={y} t={t} />}
            {bubble && (
              <text x={npc.x} y={y - (npc.kind === "kid" ? 44 : 60)} textAnchor="middle" fontSize={16} fontWeight={900} fill={INK}>
                {bubble}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function createNpcs(seed: string, width: number, anchors: LifeAnchors, walkY: Record<Side, number>): Npc[] {
  const counts = allocateWalkers(anchors.homes, STREET_LIFE.maxWalkers);
  const now = performance.now() / 1000;
  const npcs: Npc[] = [];
  let dogGiven = false;
  const biggest = [...anchors.homes].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))[0];

  for (const home of anchors.homes) {
    for (let n = 0; n < (counts[home.id] ?? 0); n++) {
      // Jede Figur hat ihr festes Aussehen (gleiche ID → gleiche Person, auch nach dem Neuladen).
      const id = `${home.id}:${n}`;
      const random = seededRandom(hashString(`life:${seed}:${id}`));
      const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
      const kid = n > 0 && random() < STREET_LIFE.kidShare;
      const dog = !dogGiven && !kid && home === biggest && (counts[home.id] ?? 0) >= 2;
      if (dog) dogGiven = true;
      const start = random();
      const x = home.x + (random() * 2 - 1) * home.half * 0.6;
      npcs.push({
        id,
        kind: kid ? "kid" : "adult",
        home,
        x: dog ? 20 + random() * (width - 40) : x,
        y: walkY[home.side],
        side: home.side,
        dir: random() < 0.5 ? 1 : -1,
        speed: between(kid ? STREET_LIFE.kidSpeed : STREET_LIFE.adultSpeed, random()),
        phase: random() * 10,
        skin: pick(SKINS),
        shirt: pick(SHIRTS),
        hair: pick(HAIR),
        // Beim Öffnen: die meisten stehen vor dem Haus, manche sind noch drinnen.
        mode: dog ? "stroll" : start < 0.25 ? "inside" : "hang",
        until: now + (start < 0.25 ? random() * 12 : 2 + random() * 12),
        path: [],
        arrive: null,
        area: home,
        wander: null,
        bag: false,
        dog,
        litters: !kid && !dog && random() < 0.15,
        emote: null,
        watching: null,
        nextEventAt: dog ? now + 15 + random() * 20 : now + 20 + random() * 30,
        pausedUntil: 0,
      });
    }
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
      {npc.bag && (
        <g>
          <path d={`M${4 - swing * 0.6} -15 Q${6 - swing * 0.6} -19 ${8 - swing * 0.6} -15`} stroke={INK} strokeWidth={1} fill="none" />
          <rect x={2 - swing * 0.6} y={-15} width={9} height={10} rx={1.5} fill="#f4d58d" stroke={INK} strokeWidth={1.2} />
        </g>
      )}
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
