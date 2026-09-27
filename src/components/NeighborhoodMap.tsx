import { bearing, largestGapMiddle, spreadBearings } from "../game/bots";
import { residentsOf } from "../game/life";
import { possessive } from "../game/names";
import type { Bot, Neighborhood, Street } from "../model/types";

const SIZE = 360;
const C = SIZE / 2;
const RADIUS = 124;
const INK = "#2b2118";

/** Straße eines echten Mitspielers. */
export interface PlayerNeighbor {
  street: Street;
  ownerName: string;
}

/** Mehr passen nicht beschriftet auf die Karte. */
export const MAP_SLOTS = 5;

/**
 * Wer auf die Karte kommt: echte Mitspieler in der Nähe zuerst, freie Plätze füllen Bots
 * (die, bei denen man Grundstücke hat, zuerst). Der Rest steht unter der Karte.
 */
export function mapNeighbors(neighborhood: Neighborhood, streets: Record<string, Street>, players: PlayerNeighbor[], playerId: string) {
  const shownPlayers = players.slice(0, MAP_SLOTS);
  const ownsThere = (bot: Bot) => streets[bot.streetId]?.plots.some((p) => p.ownerId === playerId) ?? false;
  const bots = [...neighborhood.bots].sort((a, b) => Number(ownsThere(b)) - Number(ownsThere(a)));
  const free = MAP_SLOTS - shownPlayers.length;
  return { shownPlayers, shownBots: bots.slice(0, free), hiddenBots: bots.slice(free) };
}

interface Props {
  neighborhood: Neighborhood;
  players: PlayerNeighbor[];
  playerStreet: Street;
  playerName: string;
  playerId: string;
  streets: Record<string, Street>;
  unreadByStreet: Record<string, number>;
  onSelect: (streetId: string) => void;
}

const shorten = (name: string, max = 17) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

/** Karte: eigene Straße in der Mitte, Nachbarstraßen (Mitspieler und Bots) in ihrer Himmelsrichtung drumherum. */
export function NeighborhoodMap({ neighborhood, players, playerStreet, playerName, playerId, streets, unreadByStreet, onSelect }: Props) {
  const { shownPlayers, shownBots } = mapNeighbors(neighborhood, streets, players, playerId);
  const entries = [
    ...shownPlayers.map((p) => ({
      street: p.street,
      avatar: "🧑",
      owner: p.ownerName,
      real: true,
      angle: playerStreet.osm && p.street.osm ? bearing(playerStreet.osm, p.street.osm) : null,
    })),
    ...shownBots.flatMap((bot) => {
      const street = streets[bot.streetId];
      return street ? [{ street, avatar: bot.avatar, owner: bot.name, real: false, angle: neighborhood.bearings[street.id] ?? null }] : [];
    }),
  ];
  // Richtungen ohne Koordinaten in die größten Lücken setzen, dann so verteilen, dass sich nichts überlappt.
  const known: number[] = entries.flatMap((e) => (e.angle === null ? [] : [e.angle]));
  const raw = entries.map((e) => {
    if (e.angle !== null) return e.angle;
    const angle = largestGapMiddle(known);
    known.push(angle);
    return angle;
  });
  const angles = spreadBearings(raw);
  const nodes = entries.map((entry, i) => {
    const angle = (angles[i] * Math.PI) / 180;
    const x = Math.min(SIZE - 62, Math.max(62, C + RADIUS * Math.cos(angle)));
    const y = Math.min(SIZE - 44, Math.max(40, C - RADIUS * Math.sin(angle)));
    const built = entry.street.plots.filter((p) => p.building).length;
    const mine = entry.street.plots.filter((p) => p.ownerId === playerId).length;
    const people = Math.round(residentsOf(entry.street));
    return { ...entry, x, y, built, mine, people };
  });

  return (
    <svg className="map" viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Nachbarschaftskarte">
      <rect width={SIZE} height={SIZE} rx={20} fill="#cfe8c4" />
      {/* ein paar Häuserblöcke als Hintergrund */}
      {[
        [30, 40, 70, 44],
        [270, 30, 60, 56],
        [24, 270, 80, 50],
        [262, 280, 74, 46],
        [150, 300, 60, 34],
        [140, 26, 70, 30],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={8} fill="#b8d9ad" />
      ))}

      {nodes.map(({ street, x, y }) => (
        <g key={`road-${street.id}`}>
          <line x1={C} y1={C} x2={x} y2={y} stroke="#4a4a5a" strokeWidth={16} strokeLinecap="round" />
          <line x1={C} y1={C} x2={x} y2={y} stroke="#fff" strokeWidth={2} strokeDasharray="8 8" />
        </g>
      ))}

      <text x={SIZE - 22} y={30} textAnchor="middle" fontSize={14} fontWeight={900} fill={INK}>
        N
      </text>
      <path d={`M${SIZE - 22} 34 l-6 12 h12 z`} fill={INK} />

      {/* eigene Straße */}
      <g>
        <rect x={C - 54} y={C - 20} width={108} height={40} rx={20} fill="#ff7a45" stroke={INK} strokeWidth={3} />
        <text x={C} y={C - 3} textAnchor="middle" fontSize={10} fontWeight={800} fill="#ffe8a3">
          {shorten(possessive(playerName), 16)}
        </text>
        <text x={C} y={C + 12} textAnchor="middle" fontSize={11.5} fontWeight={900} fill="#fff">
          {shorten(playerStreet.name, 15)}
        </text>
      </g>

      {nodes.map(({ street, avatar, owner, real, x, y, built, mine, people }) => {
        const unread = unreadByStreet[street.id] ?? 0;
        return (
          <g
            key={street.id}
            className={`map-node${real ? " real" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${street.name} von ${owner}${real ? " (Mitspieler)" : ""}, ${built} Gebäude, ${people} Bewohner${mine ? `, ${mine} davon deine Grundstücke` : ""}${unread ? `, ${unread} Neuigkeiten` : ""}`}
            onClick={() => onSelect(street.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(street.id);
              }
            }}
          >
            <rect
              x={x - 60}
              y={y + 8}
              width={120}
              height={34}
              rx={10}
              fill={real ? "#e3f6ff" : "#fff"}
              stroke={mine ? "#ff7a45" : real ? "#1a73e8" : INK}
              strokeWidth={mine || real ? 4 : 2.5}
            />
            <text x={x} y={y + 23} textAnchor="middle" fontSize={11} fontWeight={900} fill={INK}>
              {shorten(street.name)}
            </text>
            <text x={x} y={y + 36} textAnchor="middle" fontSize={9} fontWeight={700} fill="#7a6a5a">
              {mine ? `${mine}× deins · 👥 ${people}` : `${shorten(owner, 11)} · 👥 ${people}`}
            </text>
            <circle className="map-avatar" cx={x} cy={y - 8} r={20} fill={real ? "#e3f6ff" : "#fff7e8"} stroke={real ? "#1a73e8" : INK} strokeWidth={real ? 3.5 : 2.5} />
            <text x={x} y={y - 1} textAnchor="middle" fontSize={20}>
              {avatar}
            </text>
            {unread > 0 && (
              <g>
                <circle cx={x + 17} cy={y - 24} r={9} fill="#d6344f" stroke="#fff" strokeWidth={2} />
                <text x={x + 17} y={y - 20.5} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fff">
                  {unread > 9 ? "9+" : unread}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
