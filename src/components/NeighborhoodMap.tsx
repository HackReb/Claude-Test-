import { possessive } from "../game/names";
import type { Neighborhood, Street } from "../model/types";

const SIZE = 360;
const C = SIZE / 2;
const RADIUS = 124;
const INK = "#2b2118";

interface Props {
  neighborhood: Neighborhood;
  playerStreet: Street;
  playerName: string;
  playerId: string;
  streets: Record<string, Street>;
  unreadByBot: Record<string, number>;
  onSelect: (streetId: string) => void;
}

const shorten = (name: string, max = 17) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

/** Karte: eigene Straße in der Mitte, Bot-Straßen in ihrer Himmelsrichtung drumherum. */
export function NeighborhoodMap({ neighborhood, playerStreet, playerName, playerId, streets, unreadByBot, onSelect }: Props) {
  const nodes = neighborhood.bots.flatMap((bot) => {
    const street = streets[bot.streetId];
    if (!street) return [];
    const angle = ((neighborhood.bearings[street.id] ?? 90) * Math.PI) / 180;
    const x = Math.min(SIZE - 62, Math.max(62, C + RADIUS * Math.cos(angle)));
    const y = Math.min(SIZE - 44, Math.max(40, C - RADIUS * Math.sin(angle)));
    const built = street.plots.filter((p) => p.building).length;
    const mine = street.plots.filter((p) => p.ownerId === playerId).length;
    return [{ bot, street, x, y, built, mine }];
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

      {nodes.map(({ bot, x, y }) => (
        <g key={`road-${bot.id}`}>
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

      {nodes.map(({ bot, street, x, y, built, mine }) => {
        const unread = unreadByBot[bot.id] ?? 0;
        return (
          <g
            key={bot.id}
            className="map-node"
            role="button"
            tabIndex={0}
            aria-label={`${street.name} von ${bot.name}, ${built} Gebäude${mine ? `, ${mine} davon deine Grundstücke` : ""}${unread ? `, ${unread} Neuigkeiten` : ""}`}
            onClick={() => onSelect(street.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(street.id);
              }
            }}
          >
            <rect x={x - 60} y={y + 8} width={120} height={34} rx={10} fill="#fff" stroke={mine ? "#ff7a45" : INK} strokeWidth={mine ? 4 : 2.5} />
            <text x={x} y={y + 23} textAnchor="middle" fontSize={11} fontWeight={900} fill={INK}>
              {shorten(street.name)}
            </text>
            <text x={x} y={y + 36} textAnchor="middle" fontSize={9} fontWeight={700} fill="#7a6a5a">
              {mine ? `${mine}× deins · ${built} 🏠` : `${bot.name} · ${built} 🏠`}
            </text>
            <circle className="map-avatar" cx={x} cy={y - 8} r={20} fill="#fff7e8" stroke={INK} strokeWidth={2.5} />
            <text x={x} y={y - 1} textAnchor="middle" fontSize={20}>
              {bot.avatar}
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
