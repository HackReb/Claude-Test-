import type { ReactNode } from "react";
import { gagsOf, type Gag } from "../game/gags";
import { hashString, seededRandom } from "../game/random";
import type { BuildingUse, Facade, PlacedPart, PlotSize } from "../model/types";
import { getPart } from "../parts/catalog";
import { FACADE_GRID, facadeDimensions } from "../parts/grid";

// Kleine Szenen an einem Gebäude, ganz in SVG-Animationen (SMIL) – kein JavaScript pro Bild nötig.
// Koordinaten wie in FacadeSvg: (0,0) oben links am Dach, Boden bei y = Höhe der Fassade.

const { cellWidth: CW, cellHeight: CH, roofHeight: RH } = FACADE_GRID;
const INK = "#2b2118";
const SKINS = ["#f1c7a3", "#d9a066", "#a86b3c", "#7a4a2a", "#ffdbac"];
const SHIRTS = ["#1982c4", "#ef476f", "#06d6a0", "#ffca3a", "#6a4c93", "#ff7a45", "#8ac926"];
const HAIR = ["#2b2118", "#6b4226", "#e0b050", "#b5533c", "#555"];
const CHAT = ["💬", "😂", "❤️", "☕", "⚽", "🙄", "🐶", "🍕", "😮", "👋"];

/** Glasfläche der Fenster (Zellkoordinaten) – dort fahren Rollläden runter. Bullaugen haben keine. */
const SHUTTER_AREA: Record<string, { x: number; y: number; w: number; h: number }> = {
  "window-square": { x: 8, y: 16, w: 24, h: 22 },
  "window-arch": { x: 9, y: 20, w: 22, h: 18 },
  "window-balcony": { x: 9, y: 12, w: 22, h: 27 },
};

/** Türöffnung (Zellkoordinaten), wird beim Auf- und Zugehen dunkel. */
const DOORWAY: Record<string, { x: number; y: number; w: number }> = {
  "door-shop": { x: 10, y: 17, w: 20 },
  "door-arch": { x: 9, y: 22, w: 22 },
  "door-glass": { x: 5, y: 17, w: 30 },
  "door-house": { x: 11, y: 18, w: 18 },
};

type Random = () => number;
const pick = <T,>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface Props {
  facade: Facade;
  size: PlotSize;
  use: BuildingUse;
  /** Für reproduzierbare, aber je Gebäude verschiedene Abläufe (z. B. Gebäude-ID). */
  seed: string;
  /** Detailansicht: mehr los als in der Straße. */
  detail?: boolean;
}

/** Leute an der Tür, Plausch vor dem Haus, Rollläden – und je Laden ein kleiner Gag. */
export function FacadeLife({ facade, size, use, seed, detail = false }: Props) {
  if (prefersReducedMotion()) return null;
  const random = seededRandom(hashString(`life:${seed}`));
  const { width, height } = facadeDimensions(size, facade.floors);
  const top = (y: number) => RH + (facade.floors - 1 - y) * CH;
  const scene: Scene = { width, height, top, random, seed, facade };

  const doors = facade.parts.filter((p) => p.y === 0 && DOORWAY[p.partId]).slice(0, 2);
  const shutterWindows = facade.parts.filter((p) => SHUTTER_AREA[p.partId]);
  const homes = use === "residential";
  const shutters = homes ? shuffled(shutterWindows, random).slice(0, detail ? shutterWindows.length : 3) : [];
  const gags = use === "commercial" ? gagsOf(facade) : [];
  // Nicht vor der Tür und nicht vor dem Gag plaudern.
  const busy = new Set([...doors.map((d) => d.x), ...gags.map((g) => g.x)]);
  const columns = width / CW;
  const freeCells = Array.from({ length: columns }, (_, x) => x).filter((x) => !busy.has(x));
  const chatAt = freeCells.length > 0 ? pick(freeCells, random) : undefined;

  return (
    <g className="facade-life" aria-hidden pointerEvents="none">
      {shutters.map((w, i) => (
        <Shutter key={`s${i}`} part={w} scene={scene} />
      ))}
      {gags.map((gag) => (
        <GagScene key={gag.kind} gag={gag} scene={scene} />
      ))}
      {doors.map((d, i) => (
        <DoorTraffic key={`d${i}`} door={d} scene={scene} shop={!homes} fast={detail} />
      ))}
      {chatAt !== undefined && (homes || detail) && <Chatters x={chatAt * CW + CW / 2} scene={scene} />}
    </g>
  );
}

interface Scene {
  width: number;
  height: number;
  top: (y: number) => number;
  random: Random;
  seed: string;
  facade: Facade;
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const keyTimes = (...times: number[]) => times.join(";");
const begin = (random: Random, dur: number) => `-${(random() * dur).toFixed(1)}s`;

/** Wiederholt eine Animation endlos mit gemeinsamer Dauer und Startversatz. */
function Anim({ attr, values, times, dur, start }: { attr: string; values: string; times: string; dur: number; start: string }) {
  return <animate attributeName={attr} values={values} keyTimes={times} dur={`${dur}s`} begin={start} repeatCount="indefinite" />;
}

function Move({ type, values, times, dur, start }: { type: "translate" | "rotate" | "scale"; values: string; times: string; dur: number; start: string }) {
  return <animateTransform attributeName="transform" type={type} values={values} keyTimes={times} dur={`${dur}s`} begin={start} repeatCount="indefinite" />;
}

// ---------- Figuren ----------

interface Look {
  skin: string;
  shirt: string;
  hair: string;
}
const lookOf = (random: Random): Look => ({ skin: pick(SKINS, random), shirt: pick(SHIRTS, random), hair: pick(HAIR, random) });

/** Kleine Figur, Füße bei (0,0). */
function Person({ look, kid = false, bag = false, children }: { look: Look; kid?: boolean; bag?: boolean; children?: ReactNode }) {
  return (
    <g transform={kid ? "scale(0.75)" : undefined}>
      <path d="M-2 0v-7M2 0v-7" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <rect x={-4.5} y={-16} width={9} height={10} rx={3} fill={look.shirt} stroke={INK} strokeWidth={1.5} />
      <circle cy={-19.5} r={4} fill={look.skin} stroke={INK} strokeWidth={1.5} />
      <path d="M-4 -20a4 4 0 0 1 8 0z" fill={look.hair} />
      {bag && <rect x={4} y={-10} width={5} height={6} rx={1} fill="#fff" stroke={INK} strokeWidth={1.2} />}
      {children}
    </g>
  );
}

// ---------- Tür: Leute kommen raus und gehen rein ----------

function DoorTraffic({ door, scene, shop, fast }: { door: PlacedPart; scene: Scene; shop: boolean; fast: boolean }) {
  const { random, height, width } = scene;
  const way = DOORWAY[door.partId];
  const cx = door.x * CW + CW / 2;
  const dir = cx < width / 2 ? -1 : 1;
  const dist = Math.max(30, dir < 0 ? cx + 12 : width - cx + 12);
  const dur = (shop ? 9 : 14) * (fast ? 0.7 : 1) + random() * 5;
  const start = begin(random, dur);
  const out = lookOf(random);
  const back = lookOf(random);
  const doorTop = height - CH + way.y;
  return (
    <g>
      <rect x={door.x * CW + way.x} y={doorTop} width={way.w} height={height - doorTop} fill={INK} opacity={0}>
        <Anim attr="opacity" values="0;0;.75;.75;0;0;.75;.75;0;0" times={keyTimes(0, 0.1, 0.13, 0.2, 0.23, 0.76, 0.79, 0.86, 0.89, 1)} dur={dur} start={start} />
      </rect>
      {/* raus … */}
      <g opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.12, 0.15, 0.4, 0.45, 1)} dur={dur} start={start} />
        <g transform={`translate(${cx} ${height})`}>
          <g>
            <Move type="translate" values={`0 0;0 0;${dir * dist} 0;${dir * dist} 0`} times={keyTimes(0, 0.15, 0.45, 1)} dur={dur} start={start} />
            <Person look={out} bag={shop} />
          </g>
        </g>
      </g>
      {/* … und rein */}
      <g opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.52, 0.56, 0.8, 0.83, 1)} dur={dur} start={start} />
        <g transform={`translate(${cx} ${height})`}>
          <g>
            <Move type="translate" values={`${-dir * dist} 0;${-dir * dist} 0;0 0;0 0`} times={keyTimes(0, 0.55, 0.8, 1)} dur={dur} start={start} />
            <Person look={back} />
          </g>
        </g>
      </g>
    </g>
  );
}

// ---------- Plausch vor dem Haus ----------

function Bubble({ x, text, times, dur, start }: { x: number; text: string; times: string; dur: number; start: string }) {
  return (
    <g opacity={0} transform={`translate(${x} -38)`}>
      <Anim attr="opacity" values="0;0;1;1;0;0" times={times} dur={dur} start={start} />
      <rect x={-9} y={-9} width={18} height={15} rx={5} fill="#fff" stroke={INK} strokeWidth={1.5} />
      <path d="M-2 6l2 4 2-4" fill="#fff" stroke={INK} strokeWidth={1.2} />
      <text y={3} textAnchor="middle" fontSize={10}>
        {text}
      </text>
    </g>
  );
}

function Chatters({ x, scene }: { x: number; scene: Scene }) {
  const { random, height } = scene;
  const dur = 7 + random() * 4;
  const start = begin(random, dur);
  const a = lookOf(random);
  const b = lookOf(random);
  const kid = random() < 0.3;
  return (
    <g transform={`translate(${x} ${height})`}>
      <g transform="translate(-7 0)">
        <Person look={a} />
      </g>
      <g transform="translate(7 0)">
        <Person look={b} kid={kid} />
      </g>
      <Bubble x={-9} text={pick(CHAT, random)} times={keyTimes(0, 0.05, 0.08, 0.35, 0.4, 1)} dur={dur} start={start} />
      <Bubble x={9} text={pick(CHAT, random)} times={keyTimes(0, 0.5, 0.53, 0.8, 0.85, 1)} dur={dur} start={start} />
    </g>
  );
}

// ---------- Rollläden ----------

function Shutter({ part, scene }: { part: PlacedPart; scene: Scene }) {
  const area = SHUTTER_AREA[part.partId];
  const { random, top } = scene;
  const dur = 16 + random() * 14;
  const start = begin(random, dur);
  const slats = Array.from({ length: Math.floor(area.h / 4) }, (_, i) => i * 4 + 4);
  return (
    <g transform={`translate(${part.x * CW + area.x} ${top(part.y) + area.y})`}>
      <g transform="scale(1 0)">
        <Move type="scale" values="1 0;1 0;1 1;1 1;1 0;1 0" times={keyTimes(0, 0.3, 0.38, 0.72, 0.8, 1)} dur={dur} start={start} />
        <rect width={area.w} height={area.h} fill="#cbc0d3" stroke={INK} strokeWidth={1.5} />
        {slats.map((y) => (
          <path key={y} d={`M1 ${y}h${area.w - 2}`} stroke="#9a8c98" strokeWidth={1} />
        ))}
      </g>
    </g>
  );
}

// ---------- Gags ----------

function GagScene({ gag, scene }: { gag: Gag; scene: Scene }) {
  switch (gag.kind) {
    case "doner":
      return <DonerGag gag={gag} scene={scene} />;
    case "optician":
      return <OpticianGag gag={gag} scene={scene} />;
    case "icecream":
      return <IceCreamGag gag={gag} scene={scene} />;
    case "hair":
      return <HairGag gag={gag} scene={scene} />;
    case "bakery":
      return <Steam scene={scene} color="#fff" />;
    case "stink":
      return <StinkGag scene={scene} />;
    case "pizza":
      return <TossGag gag={gag} scene={scene} emoji="🍕" />;
    case "laundry":
      return <LaundryGag scene={scene} />;
    case "cinema":
      return <PopcornGag gag={gag} scene={scene} />;
    case "flowers":
      return <BeeGag gag={gag} scene={scene} />;
    case "pool":
      return <SplashGag gag={gag} scene={scene} />;
    case "balloon":
      return <BalloonGag gag={gag} scene={scene} />;
  }
}

const cellAt = (facade: Facade, gag: Gag) => facade.parts.find((p) => p.x === gag.x && p.y === gag.y && getPart(p.partId)?.category === "window");

/** Dönerspieß dreht sich – und fängt ab und zu Feuer. Ohne Grill-Fenster qualmt es aus dem Dach. */
function DonerGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { random, top, facade, seed } = scene;
  const grill = cellAt(facade, gag)?.partId === "window-doner";
  if (!grill) return <Steam scene={scene} color="#bbb" />;
  const x = gag.x * CW;
  const y = top(gag.y);
  const clip = `doner-${hashString(seed)}-${gag.x}-${gag.y}`;
  const dur = 10 + random() * 6;
  const start = begin(random, dur);
  return (
    <g transform={`translate(${x} ${y})`}>
      <clipPath id={clip}>
        <path d="M12 18h12l-3 18h-6z" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g>
          <Move type="translate" values="0 0;4 0" times="0;1" dur={0.7} start="0s" />
          {[6, 10, 14, 18, 22, 26].map((sx) => (
            <path key={sx} d={`M${sx} 16l2 22`} stroke="#7a3e10" strokeWidth={1.6} opacity={0.7} />
          ))}
        </g>
      </g>
      {/* Feuer! */}
      <g transform="translate(18 36)">
        <g transform="scale(0)">
          <Move type="scale" values="0;0;1;1.25;0.9;1.2;0;0" times={keyTimes(0, 0.55, 0.6, 0.66, 0.72, 0.78, 0.84, 1)} dur={dur} start={start} />
          <path d="M0 0c-9 0-10-10-5-16c0 5 3 6 3 6c0-8 4-12 8-15c-1 6 6 9 5 17c-1 6-5 8-11 8z" fill="#ff7b00" stroke={INK} strokeWidth={1.2} />
          <path d="M1 -2c-4 0-5-5-2-8c1 3 3 3 3 3c0-3 2-5 4-6c0 4 2 6 1 8c-1 2-3 3-6 3z" fill="#ffd166" />
        </g>
      </g>
      <text x={18} y={27} textAnchor="middle" fontSize={9} fontWeight={900} fill="#e63946" stroke="#fff" strokeWidth={2.5} paintOrder="stroke" opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.6, 0.62, 0.8, 0.84, 1)} dur={dur} start={start} />
        HEISS!
      </text>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={18 + (i - 1) * 5} cy={16} r={4} fill="#999" opacity={0}>
          <Anim attr="opacity" values="0;0;.7;0;0" times={keyTimes(0, 0.82 + i * 0.03, 0.85 + i * 0.03, 0.97, 1)} dur={dur} start={start} />
          <Anim attr="cy" values="16;16;16;-10;-10" times={keyTimes(0, 0.82 + i * 0.03, 0.85 + i * 0.03, 0.97, 1)} dur={dur} start={start} />
        </circle>
      ))}
    </g>
  );
}

/** Jemand läuft gegen das Schaufenster vom Optiker, fällt um und sieht Sterne. */
function OpticianGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { random, height } = scene;
  const target = gag.x * CW + 8;
  const from = target - 55;
  const dur = 13 + random() * 5;
  const start = begin(random, dur);
  const look = lookOf(random);
  return (
    <g>
      <g opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.04, 0.06, 0.76, 0.8, 1)} dur={dur} start={start} />
        <g transform={`translate(0 ${height})`}>
          <g>
            <Move type="translate" values={`${from} 0;${from} 0;${target} 0;${target} 0;${from} 0;${from} 0`} times={keyTimes(0, 0.05, 0.25, 0.55, 0.75, 1)} dur={dur} start={start} />
            <g>
              <Move type="rotate" values="0;0;-85;-85;0;0" times={keyTimes(0, 0.25, 0.29, 0.5, 0.55, 1)} dur={dur} start={start} />
              <Person look={look}>
                {/* Nase im Handy */}
                <rect x={3} y={-17} width={4} height={6} rx={1} fill="#333" />
              </Person>
            </g>
            <text x={-20} y={-6} textAnchor="middle" fontSize={10} opacity={0}>
              <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.29, 0.31, 0.48, 0.5, 1)} dur={dur} start={start} />
              💫
            </text>
            <text x={6} y={-30} textAnchor="middle" fontSize={9} fontWeight={900} fill="#e63946" stroke="#fff" strokeWidth={2.5} paintOrder="stroke" opacity={0}>
              <Anim attr="opacity" values="0;0;1;0;0" times={keyTimes(0, 0.25, 0.26, 0.34, 1)} dur={dur} start={start} />
              BONK!
            </text>
          </g>
        </g>
      </g>
    </g>
  );
}

/** Kind mit Eis – die Kugel fällt runter. */
function IceCreamGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { random, height, width } = scene;
  const from = Math.min(width - 50, gag.x * CW + CW / 2);
  const stop = from + 30;
  const dur = 12 + random() * 5;
  const start = begin(random, dur);
  const look = lookOf(random);
  return (
    <g>
      <ellipse cx={stop + 5} cy={height - 1} rx={5} ry={2} fill="#ffafcc" stroke={INK} strokeWidth={1} opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.44, 0.45, 0.8, 0.85, 1)} dur={dur} start={start} />
      </ellipse>
      <g opacity={0}>
        <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.08, 0.1, 0.86, 0.9, 1)} dur={dur} start={start} />
        <g transform={`translate(0 ${height})`}>
          <g>
            <Move type="translate" values={`${from} 0;${from} 0;${stop} 0;${stop} 0;${stop + 40} 0;${stop + 40} 0`} times={keyTimes(0, 0.1, 0.35, 0.7, 0.88, 1)} dur={dur} start={start} />
            <Person look={look} kid />
            <path d="M3 -9l2 6 2-6z" fill="#e9c46a" stroke={INK} strokeWidth={0.8} />
            <circle cx={5} cy={-10.5} r={2.6} fill="#ffafcc" stroke={INK} strokeWidth={0.8}>
              <Anim attr="cy" values="-10.5;-10.5;-1;-1;-10.5" times={keyTimes(0, 0.37, 0.44, 0.99, 1)} dur={dur} start={start} />
              <Anim attr="opacity" values="1;1;1;0;0;1" times={keyTimes(0, 0.37, 0.44, 0.45, 0.99, 1)} dur={dur} start={start} />
            </circle>
            <g opacity={0} transform="translate(0 -30)">
              <Anim attr="opacity" values="0;0;1;1;0;0" times={keyTimes(0, 0.46, 0.48, 0.68, 0.7, 1)} dur={dur} start={start} />
              <text textAnchor="middle" fontSize={11}>
                😭
              </text>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/** Schere schnippelt im Fenster vom Friseur, Haare fliegen. */
function HairGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { random, top } = scene;
  const window = scene.facade.parts.find((p) => p.y === 0 && getPart(p.partId)?.category === "window") ?? { x: gag.x, y: gag.y };
  const cx = window.x * CW + CW / 2;
  const cy = top(window.y) + 27;
  const start = begin(random, 2);
  return (
    <g>
      <g transform={`translate(${cx} ${cy})`}>
        <g>
          <Move type="rotate" values="-18;18;-18" times="0;.5;1" dur={0.5} start={start} />
          <text textAnchor="middle" y={4} fontSize={12}>
            ✂️
          </text>
        </g>
      </g>
      {[-5, 0, 5].map((dx, i) => (
        <path key={dx} d={`M${cx + dx} ${cy + 6}q2 2 0 4`} stroke="#6b4226" strokeWidth={1.4} fill="none" opacity={0}>
          <Anim attr="opacity" values="0;1;0" times="0;.2;1" dur={1.6} start={`${-i * 0.5}s`} />
          <animateTransform attributeName="transform" type="translate" values="0 0;0 12" dur="1.6s" begin={`${-i * 0.5}s`} repeatCount="indefinite" />
        </path>
      ))}
    </g>
  );
}

/** Dampf aus dem Schornstein (Bäckerei) bzw. Grillrauch vom Dach. */
function Steam({ scene, color }: { scene: Scene; color: string }) {
  const { width, facade } = scene;
  const chimney = facade.roof.partId === "roof-chimney";
  const x = chimney ? -6 + 0.725 * (width + 12) : width / 2;
  const y = chimney ? 2 : RH * 0.4;
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x} cy={y} r={5} fill={color} stroke="#999" strokeWidth={0.8} opacity={0}>
          <Anim attr="opacity" values="0;.85;0" times="0;.2;1" dur={3} start={`${-i}s`} />
          <Anim attr="cy" values={`${y};${y - 28}`} times="0;1" dur={3} start={`${-i}s`} />
          <Anim attr="cx" values={`${x};${x + 6};${x - 3}`} times="0;.5;1" dur={3} start={`${-i}s`} />
          <Anim attr="r" values="3;8" times="0;1" dur={3} start={`${-i}s`} />
        </circle>
      ))}
    </g>
  );
}

/** Kläranlage: grüne Wolken und eine Fliege. */
function StinkGag({ scene }: { scene: Scene }) {
  const { width } = scene;
  return (
    <g>
      {[0, 1].map((i) => (
        <ellipse key={i} cx={width * (0.35 + i * 0.3)} cy={RH} rx={8} ry={5} fill="#95d5b2" opacity={0}>
          <Anim attr="opacity" values="0;.7;0" times="0;.3;1" dur={4} start={`${-i * 2}s`} />
          <Anim attr="cy" values={`${RH};${RH - 30}`} times="0;1" dur={4} start={`${-i * 2}s`} />
        </ellipse>
      ))}
      <text fontSize={9} textAnchor="middle">
        <animateMotion path={`M${width * 0.5} ${RH - 6}c14 -14 28 14 0 0c-14 -14 -28 14 0 0`} dur="3s" repeatCount="indefinite" />
        🪰
      </text>
    </g>
  );
}

/** Pizza fliegt in die Luft. */
function TossGag({ gag, scene, emoji }: { gag: Gag; scene: Scene; emoji: string }) {
  const { random, top } = scene;
  const x = gag.x * CW + CW / 2;
  const y = top(0) + 4;
  const start = begin(random, 3);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g>
        <Move type="translate" values="0 0;0 -26;0 0;0 0" times={keyTimes(0, 0.22, 0.44, 1)} dur={3} start={start} />
        <g>
          <Move type="rotate" values="0;360;360" times={keyTimes(0, 0.44, 1)} dur={3} start={start} />
          <text textAnchor="middle" y={4} fontSize={12}>
            {emoji}
          </text>
        </g>
      </g>
    </g>
  );
}

/** Waschsalon: Wäsche dreht sich in den Bullaugen. */
function LaundryGag({ scene }: { scene: Scene }) {
  const { top, facade } = scene;
  const drums = facade.parts.filter((p) => p.partId === "window-round");
  const colors = ["#ef476f", "#1982c4", "#ffca3a"];
  return (
    <g>
      {drums.map((d, i) => (
        <g key={i} transform={`translate(${d.x * CW + 20} ${top(d.y) + 27})`}>
          <g>
            <animateTransform attributeName="transform" type="rotate" values="0;360" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
            {colors.map((c, k) => (
              <rect key={c} x={-2.5} y={-8} width={5} height={4} rx={1} fill={c} transform={`rotate(${k * 120})`} />
            ))}
          </g>
        </g>
      ))}
    </g>
  );
}

/** Kino: Popcorn hüpft aus der Tür. */
function PopcornGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { top } = scene;
  const door = scene.facade.parts.find((p) => p.y === 0 && getPart(p.partId)?.category === "door");
  const x = (door?.x ?? gag.x) * CW + CW / 2;
  const y = top(0) + 18;
  return (
    <g>
      {[-8, -3, 3, 8].map((dx, i) => (
        <circle key={dx} cx={x} cy={y} r={2.2} fill="#fff8dc" stroke={INK} strokeWidth={0.8} opacity={0}>
          <Anim attr="opacity" values="0;1;1;0" times="0;.1;.8;1" dur={1.4} start={`${-i * 0.35}s`} />
          <Anim attr="cx" values={`${x};${x + dx}`} times="0;1" dur={1.4} start={`${-i * 0.35}s`} />
          <Anim attr="cy" values={`${y};${y - 16};${y - 4}`} times="0;.4;1" dur={1.4} start={`${-i * 0.35}s`} />
        </circle>
      ))}
    </g>
  );
}

/** Blumenladen: eine Biene fliegt Achten. */
function BeeGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const x = gag.x * CW + CW / 2;
  const y = scene.top(gag.y) + 20;
  return (
    <text fontSize={9} textAnchor="middle">
      <animateMotion path={`M${x} ${y}c12 -12 24 12 0 0c-12 -12 -24 12 0 0`} dur="2.6s" repeatCount="indefinite" />
      🐝
    </text>
  );
}

/** Schwimmbad: Wasser spritzt. */
function SplashGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const x = gag.x * CW + CW / 2;
  const y = scene.height - 4;
  return (
    <g>
      {[-10, -4, 4, 10].map((dx, i) => (
        <circle key={dx} cx={x} cy={y} r={2} fill="#4cc9f0" stroke={INK} strokeWidth={0.6} opacity={0}>
          <Anim attr="opacity" values="0;1;0" times="0;.2;1" dur={1.2} start={`${-i * 0.3}s`} />
          <Anim attr="cx" values={`${x};${x + dx * 1.5}`} times="0;1" dur={1.2} start={`${-i * 0.3}s`} />
          <Anim attr="cy" values={`${y};${y - 18};${y}`} times="0;.45;1" dur={1.2} start={`${-i * 0.3}s`} />
        </circle>
      ))}
    </g>
  );
}

/** Freizeitpark: ein Luftballon steigt auf. */
function BalloonGag({ gag, scene }: { gag: Gag; scene: Scene }) {
  const { random, height } = scene;
  const x = gag.x * CW + CW / 2;
  const start = begin(random, 8);
  return (
    <g transform={`translate(${x} ${height - 20})`} opacity={0}>
      <Anim attr="opacity" values="0;1;1;0" times="0;.05;.8;1" dur={8} start={start} />
      <g>
        <Move type="translate" values={`0 0;8 ${-height * 0.5};-4 ${-height - 20}`} times="0;.5;1" dur={8} start={start} />
        <text textAnchor="middle" fontSize={13}>
          🎈
        </text>
      </g>
    </g>
  );
}
