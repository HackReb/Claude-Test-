import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useOf, type Voice } from "../../game/life";
import type { LitterItem, LitterKind, Plot, Street } from "../../model/types";
import { facadeDimensions } from "../../parts/grid";
import { formatCoins } from "../../format";
import { possessive } from "../../game/names";
import { FacadeSvg } from "../FacadeSvg";
import { layoutStreet, STREET, type LotBox } from "./layout";
import { Litter } from "./Litter";
import { Playground } from "./Playground";
import { StreetLife, type LifeAnchors } from "./StreetLife";

const INK = "#2b2118";

interface Props {
  street: Street;
  /** Wem die Straße gehört – steht groß auf der Fahrbahn („Kalles Bahnhofstraße“). */
  ownerName?: string;
  /** Kaufpreis je Grundstück; fehlt bei fremden Straßen. */
  priceOf?: (plot: Plot) => number;
  coins?: number;
  onSelect?: (plot: Plot) => void;
  /** Leute, Kinder und Hund auf den Gehwegen zeigen. */
  life?: boolean;
  /** Dreck antippen; liefert die Belohnung (0 = noch nicht weg). */
  onLitterTap?: (item: LitterItem) => Promise<number>;
  /** Hund/Passant lässt live Dreck fallen. */
  onDrop?: (kind: LitterKind, spot: Pick<LitterItem, "pos" | "side">) => void;
  /** Sprechblasen über Grundstücken. */
  voices?: Voice[];
  onVoice?: (voice: Voice) => void;
  /** Sichtbarer Ausschnitt (0–1) – z. B. für passende Straßengeräusche. */
  onViewport?: (from: number, to: number) => void;
}

interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
}

/** Straße von leicht schräg oben: linke Seite oben, Fahrbahn in der Mitte, rechte Seite unten. */
export function StreetView({
  street,
  ownerName,
  priceOf,
  coins = 0,
  onSelect,
  life = false,
  onLitterTap,
  onDrop,
  voices = [],
  onVoice,
  onViewport,
}: Props) {
  const { lots, roadTop, roadBottom, width, height } = layoutStreet(street.plots);
  const scroller = useRef<HTMLDivElement>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const litterY = { top: roadTop - 13, bottom: roadBottom + 15 };
  const walkY = useMemo(() => ({ top: roadTop - 6, bottom: roadBottom + STREET.sidewalk - 6 }), [roadTop, roadBottom]);

  // Wo wohnen Leute, wo wird eingekauft, wo gespielt? (stabil, solange sich daran nichts ändert)
  const anchorKey = lots
    .map((l) => `${l.x}:${l.plot.amenity ?? (l.plot.purchasedAt !== undefined && l.plot.building ? useOf(l.plot.building) : "")}`)
    .join(",");
  const anchors = useMemo<LifeAnchors>(() => {
    const center = (l: LotBox) => l.x + l.width / 2;
    const owned = lots.filter((l) => l.plot.purchasedAt !== undefined);
    return {
      homes: owned.filter((l) => l.plot.building && useOf(l.plot.building) === "residential").map(center),
      shops: owned.filter((l) => l.plot.building && useOf(l.plot.building) === "commercial").map(center),
      playgrounds: owned.filter((l) => l.plot.amenity === "playground").map(center),
    };
  }, [anchorKey]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !onViewport) return;
    const report = () => {
      const svgWidth = el.scrollWidth || 1;
      onViewport(el.scrollLeft / svgWidth, (el.scrollLeft + el.clientWidth) / svgWidth);
    };
    report();
    el.addEventListener("scroll", report, { passive: true });
    window.addEventListener("resize", report);
    return () => {
      el.removeEventListener("scroll", report);
      window.removeEventListener("resize", report);
    };
  }, [onViewport]);

  async function tapLitter(item: LitterItem) {
    if (!onLitterTap) return;
    const reward = await onLitterTap(item);
    if (reward > 0) {
      const popup = { id: Date.now() + Math.random(), x: item.pos * width, y: litterY[item.side] - 20, text: `+${reward} 🪙` };
      setPopups((list) => [...list, popup]);
      setTimeout(() => setPopups((list) => list.filter((p) => p.id !== popup.id)), 1000);
    }
  }
  const voiceByPlot = new Map(voices.filter((v) => v.plotId).map((v) => [v.plotId!, v]));
  const roadMid = (roadTop + roadBottom) / 2;
  const owner = ownerName ? `${possessive(ownerName)} ` : "";
  const streetLabel = street.name.length > 24 ? `${street.name.slice(0, 23)}…` : street.name;
  // Grobe Textbreite bei 20px fett – die Mittellinie beginnt hinter dem Namen.
  const labelEnd = STREET.padX + 8 + (owner.length + streetLabel.length) * 12 + 24;

  return (
    <div className="street-scroll" ref={scroller}>
      <svg
        className="street-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label={`${street.name}, ${street.city}`}
      >
        {/* Gehwege und Fahrbahn */}
        <rect x={0} y={roadTop - STREET.sidewalk} width={width} height={STREET.sidewalk} fill="#e3dccf" />
        <rect x={0} y={roadBottom} width={width} height={STREET.sidewalk} fill="#e3dccf" />
        <rect x={0} y={roadTop} width={width} height={STREET.road} fill="#4a4a5a" />
        <line
          x1={labelEnd}
          x2={width}
          y1={roadMid}
          y2={roadMid}
          stroke="#fff"
          strokeWidth={4}
          strokeDasharray="22 18"
        />
        <text x={STREET.padX + 8} y={roadMid + 7} fontSize={20} fontWeight={900} fill="#fff">
          {owner && <tspan fill="#ffd166">{owner}</tspan>}
          <tspan>{streetLabel}</tspan>
        </text>

        {lots.map((lot) => (
          <Lot
            key={lot.plot.id}
            lot={lot}
            price={priceOf?.(lot.plot)}
            affordable={priceOf ? coins >= priceOf(lot.plot) : false}
            onSelect={onSelect}
            voice={voiceByPlot.get(lot.plot.id)}
            onVoice={onVoice}
          />
        ))}

        {(street.litter ?? []).map((item) => (
          <Litter key={item.id} item={item} x={item.pos * width} y={litterY[item.side]} onTap={onLitterTap ? tapLitter : undefined} />
        ))}

        {life && <StreetLife seed={street.id} width={width} walkY={walkY} anchors={anchors} onDrop={onDrop} />}

        {popups.map((p) => (
          <text key={p.id} x={p.x} y={p.y} textAnchor="middle" fontSize={16} fontWeight={900} fill="#2b2118" className="reward-popup">
            {p.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Lot({
  lot,
  price,
  affordable,
  onSelect,
  voice,
  onVoice,
}: {
  lot: LotBox;
  price?: number;
  affordable: boolean;
  onSelect?: (plot: Plot) => void;
  voice?: Voice;
  onVoice?: (voice: Voice) => void;
}) {
  const { plot, x, y, width } = lot;
  const h = STREET.lotHeight;
  const owned = plot.purchasedAt !== undefined;
  const groundY = h - 16;

  const label = owned
    ? plot.building
      ? `${plot.building.name}, ${useOf(plot.building) === "residential" ? "Wohnhaus" : "Gewerbe"}, Grundstück ${plot.size}, Stufe ${plot.building.level}`
      : plot.amenity === "playground"
        ? `Spielplatz, Grundstück ${plot.size}`
        : `Dein Bauplatz ${plot.size}`
    : `Grundstück ${plot.size} zu verkaufen${price !== undefined ? ` für ${price} Münzen` : ""}`;

  const select = () => onSelect?.(plot);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select();
    }
  };

  return (
    <g
      className={`lot ${owned ? "lot-owned" : "lot-free"}`}
      transform={`translate(${x} ${y})`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      onClick={onSelect ? select : undefined}
      onKeyDown={onSelect ? onKeyDown : undefined}
    >
      {/* Bodenplatte mit sichtbarer Vorderkante → leichte Draufsicht */}
      <rect y={STREET.slab} width={width} height={h} rx={14} fill={owned ? "#5f9e5f" : "#a9c9a0"} />
      <rect
        className="lot-ground"
        width={width}
        height={h}
        rx={14}
        fill={owned ? "#8fd694" : "#d4ebcc"}
        stroke={INK}
        strokeWidth={3}
        strokeDasharray={owned ? undefined : "10 8"}
      />

      {plot.building ? (
        <Building lot={lot} groundY={groundY} />
      ) : owned && plot.amenity === "playground" ? (
        <Playground width={width} groundY={groundY} />
      ) : owned ? (
        <BuildSite width={width} groundY={groundY} />
      ) : (
        <ForSaleSign width={width} groundY={groundY} price={price} affordable={affordable} />
      )}

      {plot.building && <NamePlate width={width} bottom={h} name={plot.building.name} />}
      {owned && !plot.building && plot.amenity === "playground" && <NamePlate width={width} bottom={h} name="Spielplatz" />}

      {plot.building && (
        <g aria-hidden transform="translate(14 42)">
          <circle r={12} cx={12} cy={12} fill={useOf(plot.building) === "residential" ? "#d8f3dc" : "#ffe3d6"} stroke={INK} strokeWidth={2.5} />
          <text x={12} y={17} textAnchor="middle" fontSize={13}>
            {useOf(plot.building) === "residential" ? "🏠" : "🏪"}
          </text>
        </g>
      )}

      {voice && (
        <g
          className="voice-bubble"
          role="button"
          tabIndex={0}
          aria-label={`${voice.speaker}: ${voice.quote}`}
          transform={`translate(${width / 2} 30)`}
          onClick={(e) => {
            e.stopPropagation();
            onVoice?.(voice);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onVoice?.(voice);
            }
          }}
        >
          <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0; 0 -4; 0 0" dur="1.6s" repeatCount="indefinite" />
          <path d="M-20 -16 H20 A6 6 0 0 1 26 -10 V6 A6 6 0 0 1 20 12 H4 L-2 20 L-4 12 H-20 A6 6 0 0 1 -26 6 V-10 A6 6 0 0 1 -20 -16 Z" fill="#fff" stroke={INK} strokeWidth={2.5} />
          <text y={3} textAnchor="middle" fontSize={17}>
            {voice.emoji}
          </text>
          <text x={16} y={-8} textAnchor="middle" fontSize={11} fontWeight={900} fill={voice.tone === "complaint" ? "#d6344f" : "#ff7a45"}>
            !
          </text>
        </g>
      )}

      {plot.building && plot.building.level > 1 && (
        <g aria-hidden>
          <rect x={width - 14 - 24 * (plot.building.level - 1) - 8} y={14} width={24 * (plot.building.level - 1) + 8} height={24} rx={12} fill="#ffd166" stroke={INK} strokeWidth={2.5} />
          <text x={width - 14 - (24 * (plot.building.level - 1) + 8) / 2} y={31} textAnchor="middle" fontSize={15} fill={INK}>
            {"★".repeat(plot.building.level - 1)}
          </text>
        </g>
      )}

      <g transform="translate(14 14)">
        <circle r={12} cx={12} cy={12} fill="#fff" stroke={INK} strokeWidth={2.5} />
        <text x={12} y={17} textAnchor="middle" fontSize={14} fontWeight={900} fill={INK}>
          {plot.size}
        </text>
      </g>
    </g>
  );
}

function Building({ lot, groundY }: { lot: LotBox; groundY: number }) {
  const building = lot.plot.building!;
  const { width, height } = facadeDimensions(lot.plot.size, building.facade.floors);
  const left = (lot.width - width) / 2;
  return (
    <g>
      <ellipse cx={lot.width / 2} cy={groundY} rx={width / 2 + 10} ry={8} fill="#000" opacity={0.15} />
      <g transform={`translate(${left} ${groundY - height})`}>
        <FacadeSvg facade={building.facade} size={lot.plot.size} />
      </g>
    </g>
  );
}

/** Geschätzte Breite eines Zeichens (fett) als Anteil der Schriftgröße. */
const CHAR_EM = 0.62;
const PLATE_FONT = { max: 12.5, min: 9 };

/** Teilt einen Namen an dem Leerzeichen/Bindestrich, das der Mitte am nächsten liegt. */
function splitName(name: string): [string, string] | null {
  let best = -1;
  for (let i = 1; i < name.length - 1; i++) {
    if ((name[i] === " " || name[i] === "-") && (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2))) best = i;
  }
  if (best < 0) return null;
  return name[best] === "-" ? [name.slice(0, best + 1), name.slice(best + 1)] : [name.slice(0, best), name.slice(best + 1)];
}

/**
 * Namensschild eines Gebäudes auf der Vorderkante des Grundstücks. Namen werden nicht gekürzt,
 * solange es irgendwie geht: erst kleinere Schrift, dann zwei Zeilen, erst ganz zuletzt „…“.
 */
function NamePlate({ width, bottom, name }: { width: number; bottom: number; name: string }) {
  const room = width - 22;
  const fits = (text: string, size: number) => text.length * CHAR_EM * size <= room;
  const sizeFor = (longest: string) => Math.min(PLATE_FONT.max, room / (longest.length * CHAR_EM));

  let lines: string[] = [name];
  if (!fits(name, PLATE_FONT.min)) {
    const split = splitName(name);
    if (split && split.every((line) => fits(line, PLATE_FONT.min))) lines = split;
  }
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a));
  let fontSize = Math.max(PLATE_FONT.min, sizeFor(longest));
  if (!fits(longest, fontSize)) {
    const maxChars = Math.floor(room / (CHAR_EM * PLATE_FONT.min));
    lines = lines.map((line) => (line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line));
    fontSize = PLATE_FONT.min;
  }

  const lineHeight = fontSize + 2;
  const plateWidth = Math.min(width - 8, Math.max(...lines.map((l) => l.length)) * CHAR_EM * fontSize + 18);
  const plateHeight = lines.length * lineHeight + 10;
  const top = bottom + 11 - plateHeight;
  return (
    <g>
      <title>{name}</title>
      <rect x={(width - plateWidth) / 2} y={top} width={plateWidth} height={plateHeight} rx={11} fill="#fff" stroke={INK} strokeWidth={2.5} />
      {lines.map((line, i) => (
        <text key={i} x={width / 2} y={top + 5 + (i + 1) * lineHeight - 3} textAnchor="middle" fontSize={fontSize} fontWeight={800} fill={INK}>
          {line}
        </text>
      ))}
    </g>
  );
}

function BuildSite({ width, groundY }: { width: number; groundY: number }) {
  const cx = width / 2;
  return (
    <g>
      <rect x={cx - 34} y={groundY - 40} width={68} height={40} fill="#c8a27a" opacity={0.6} rx={4} />
      {[-34, 34].map((dx) => (
        <rect key={dx} x={cx + dx - 3} y={groundY - 52} width={6} height={52} fill="#ff7a45" stroke={INK} strokeWidth={2} />
      ))}
      <text x={cx} y={groundY - 60} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK}>
        Bauplatz
      </text>
    </g>
  );
}

function ForSaleSign({
  width,
  groundY,
  price,
  affordable,
}: {
  width: number;
  groundY: number;
  price?: number;
  affordable: boolean;
}) {
  const cx = width / 2;
  return (
    <g>
      <rect x={cx - 3} y={groundY - 50} width={6} height={50} fill="#8d5a3b" stroke={INK} strokeWidth={2} />
      <rect
        x={cx - 44}
        y={groundY - 96}
        width={88}
        height={50}
        rx={8}
        fill={affordable ? "#ffd166" : "#fff"}
        stroke={INK}
        strokeWidth={3}
      />
      <text x={cx} y={groundY - 79} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={INK}>
        ZU VERKAUFEN
      </text>
      {price !== undefined && (
        <g>
          <circle cx={cx - 30} cy={groundY - 61} r={7} fill="#ffc43d" stroke={INK} strokeWidth={2} />
          <text x={cx + 7} y={groundY - 56} textAnchor="middle" fontSize={15} fontWeight={900} fill={INK}>
            {formatCoins(price)}
          </text>
        </g>
      )}
    </g>
  );
}
