import type { KeyboardEvent } from "react";
import type { Plot, Street } from "../../model/types";
import { facadeDimensions } from "../../parts/grid";
import { formatCoins } from "../../format";
import { FacadeSvg } from "../FacadeSvg";
import { layoutStreet, STREET, type LotBox } from "./layout";

const INK = "#2b2118";

interface Props {
  street: Street;
  /** Kaufpreis je Grundstück; fehlt bei fremden Straßen. */
  priceOf?: (plot: Plot) => number;
  coins?: number;
  onSelect?: (plot: Plot) => void;
}

/** Straße von leicht schräg oben: linke Seite oben, Fahrbahn in der Mitte, rechte Seite unten. */
export function StreetView({ street, priceOf, coins = 0, onSelect }: Props) {
  const { lots, roadTop, roadBottom, width, height } = layoutStreet(street.plots);
  const roadMid = (roadTop + roadBottom) / 2;
  const labelEnd = STREET.padX + 190;

  return (
    <div className="street-scroll">
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
        <text x={STREET.padX + 8} y={roadMid + 7} fontSize={20} fontWeight={900} fill="#fff" opacity={0.9}>
          {street.name.length > 16 ? `${street.name.slice(0, 15)}…` : street.name}
        </text>

        {lots.map((lot) => (
          <Lot
            key={lot.plot.id}
            lot={lot}
            price={priceOf?.(lot.plot)}
            affordable={priceOf ? coins >= priceOf(lot.plot) : false}
            onSelect={onSelect}
          />
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
}: {
  lot: LotBox;
  price?: number;
  affordable: boolean;
  onSelect?: (plot: Plot) => void;
}) {
  const { plot, x, y, width } = lot;
  const h = STREET.lotHeight;
  const owned = plot.purchasedAt !== undefined;
  const groundY = h - 16;

  const label = owned
    ? plot.building
      ? `${plot.building.name}, Grundstück ${plot.size}, Stufe ${plot.building.level}`
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
      ) : owned ? (
        <BuildSite width={width} groundY={groundY} />
      ) : (
        <ForSaleSign width={width} groundY={groundY} price={price} affordable={affordable} />
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
