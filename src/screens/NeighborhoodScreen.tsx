import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NeighborhoodMap } from "../components/NeighborhoodMap";
import { formatAgo } from "../format";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

export function NeighborhoodScreen() {
  const neighborhood = useGameStore((s) => s.neighborhood);
  const streets = useGameStore((s) => s.neighborStreets);
  const street = useGameStore((s) => s.street)!;
  const playerName = useGameStore((s) => s.player!.name);
  const playerId = useGameStore((s) => s.player!.id);
  const markNewsSeen = useGameStore((s) => s.markNewsSeen);
  const navigate = useNavigate();

  // Beim Verlassen gelten die Neuigkeiten als gelesen – beim Ansehen bleiben sie noch markiert.
  useEffect(() => () => void markNewsSeen(), [markNewsSeen]);

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
  const unreadByBot: Record<string, number> = {};
  for (const n of unread) unreadByBot[n.botId] = (unreadByBot[n.botId] ?? 0) + 1;
  const botOf = (id: string) => neighborhood.bots.find((b) => b.id === id);
  const realNeighbors = Object.values(streets).some((s) => s.osm);

  return (
    <div className="neighborhood">
      <h1>Nachbarschaft</h1>
      <div className="card map-card">
        <NeighborhoodMap
          neighborhood={neighborhood}
          playerStreet={street}
          playerName={playerName}
          playerId={playerId}
          streets={streets}
          unreadByBot={unreadByBot}
          onSelect={(id) => navigate(routes.neighborStreet(id))}
        />
      </div>
      <p className="hint left">
        {realNeighbors ? "Echte Nachbarstraßen, grob in ihrer echten Richtung. " : ""}Tipp eine Straße an – dort kannst du freie Grundstücke
        kaufen und bauen.
      </p>

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
                  {bot?.avatar}
                </span>
                <div>
                  <Link to={routes.neighborStreet(n.streetId)}>{n.text}</Link>
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
