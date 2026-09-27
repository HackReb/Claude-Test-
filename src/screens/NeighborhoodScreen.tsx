import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mapNeighbors, NeighborhoodMap, type PlayerNeighbor } from "../components/NeighborhoodMap";
import { nearbyStreets } from "../game/world";
import { formatAgo } from "../format";
import { ownedStreetName } from "../game/names";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

export function NeighborhoodScreen() {
  const neighborhood = useGameStore((s) => s.neighborhood);
  const streets = useGameStore((s) => s.neighborStreets);
  const street = useGameStore((s) => s.street)!;
  const playerName = useGameStore((s) => s.player!.name);
  const playerId = useGameStore((s) => s.player!.id);
  const markNewsSeen = useGameStore((s) => s.markNewsSeen);
  const online = useGameStore((s) => s.account?.status === "online");
  const playerStreets = useGameStore((s) => s.playerStreets);
  const ownerNames = useGameStore((s) => s.ownerNames);
  const loadCity = useGameStore((s) => s.loadCity);
  const navigate = useNavigate();

  // Beim Verlassen gelten die Neuigkeiten als gelesen – beim Ansehen bleiben sie noch markiert.
  useEffect(() => () => void markNewsSeen(), [markNewsSeen]);
  useEffect(() => {
    if (online) void loadCity();
  }, [online, loadCity]);

  if (!neighborhood) {
    return (
      <section className="placeholder">
        <h1>Nachbarschaft</h1>
        <p>Deine Nachbarn ziehen gerade ein …</p>
      </section>
    );
  }

  const now = Date.now();
  const unread = neighborhood.news.filter((n) => n.at > neighborhood.newsSeenAt);
  const unreadByStreet: Record<string, number> = {};
  for (const n of unread) unreadByStreet[n.streetId] = (unreadByStreet[n.streetId] ?? 0) + 1;
  const botOf = (id?: string) => neighborhood.bots.find((b) => b.id === id);
  const realNeighbors = Object.values(streets).some((s) => s.osm);
  // Echte Mitspieler in der Nähe: kommen vor den Bots auf die Karte.
  const players: PlayerNeighbor[] = nearbyStreets(street, Object.values(playerStreets))
    .filter((s) => ownerNames[s.id])
    .map((s) => ({ street: s, ownerName: ownerNames[s.id] }));
  const { hiddenBots } = mapNeighbors(neighborhood, streets, players, playerId);

  return (
    <div className="neighborhood">
      <h1>Nachbarschaft</h1>
      <div className="card map-card">
        <NeighborhoodMap
          neighborhood={neighborhood}
          players={players}
          playerStreet={street}
          playerName={playerName}
          playerId={playerId}
          streets={streets}
          unreadByStreet={unreadByStreet}
          onSelect={(id) => navigate(routes.neighborStreet(id))}
        />
      </div>
      <p className="hint left">
        {players.length > 0 && "🧑 Blau umrandet: echte Mitspieler in deiner Nähe – was sie bauen, siehst du hier und in den Neuigkeiten. "}
        {realNeighbors ? "Echte Nachbarstraßen, grob in ihrer echten Richtung. " : ""}Tipp eine Straße an – dort kannst du freie Grundstücke
        kaufen und bauen.
      </p>
      {hiddenBots.length > 0 && (
        <p className="more-neighbors">
          Weitere Nachbarn:{" "}
          {hiddenBots.map((bot) => (
            <Link key={bot.id} className="chip" to={routes.neighborStreet(bot.streetId)}>
              {bot.avatar} {streets[bot.streetId]?.name ?? bot.name}
            </Link>
          ))}
        </p>
      )}

      {online && <CityPlayers />}

      <h2>{unread.length > 0 ? `Seit deinem letzten Besuch (${unread.length})` : "Neuigkeiten"}</h2>
      {neighborhood.news.length === 0 ? (
        <p className="subtle">Noch ruhig hier. Schau später wieder vorbei – deine Nachbarn bauen, während du weg bist.</p>
      ) : (
        <ul className="news">
          {neighborhood.news.map((n, i) => {
            const bot = botOf(n.botId);
            return (
              <li key={`${n.at}-${i}`} className={n.at > neighborhood.newsSeenAt ? "unread" : ""}>
                <span className="news-avatar" aria-hidden>
                  {n.emoji ?? bot?.avatar ?? (n.playerName ? "🧑" : "📰")}
                </span>
                <div>
                  <Link to={n.streetId === street.id ? routes.street : routes.neighborStreet(n.streetId)}>{n.text}</Link>
                  <small>{formatAgo(n.at, now)}</small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Echte Mitspieler im selben Ort – dort kann man sich einkaufen. */
function CityPlayers() {
  const ids = useGameStore((s) => s.cityStreetIds);
  const streets = useGameStore((s) => s.playerStreets);
  const owners = useGameStore((s) => s.ownerNames);
  const city = useGameStore((s) => s.street!.city);
  const playerId = useGameStore((s) => s.player!.id);

  return (
    <>
      <h2>Mitspieler in {city}</h2>
      {ids === null ? (
        <p className="subtle">Suche Mitspieler …</p>
      ) : ids.length === 0 ? (
        <p className="subtle">Noch niemand sonst aus {city} dabei. Schick deinen Freunden das Spiel!</p>
      ) : (
        <ul className="city-players">
          {ids.map((id) => {
            const street = streets[id];
            if (!street) return null;
            const free = street.plots.filter((p) => p.purchasedAt === undefined).length;
            const mine = street.plots.filter((p) => p.ownerId === playerId).length;
            return (
              <li key={id}>
                <Link className="card city-player" to={routes.neighborStreet(id)}>
                  <span aria-hidden>🧑</span>
                  <span>
                    <strong>{ownedStreetName(owners[id] ?? "", street.name)}</strong>
                    <small>
                      {street.plots.filter((p) => p.building).length} Gebäude · {free} frei{mine > 0 ? ` · ${mine} gehören dir` : ""}
                    </small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
