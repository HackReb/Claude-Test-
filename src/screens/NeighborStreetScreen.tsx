import { useCallback, useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ambienceFor } from "../audio/ambience";
import { sound } from "../audio/sound";
import { StreetView } from "../components/street/StreetView";
import { personaOf } from "../config/bots";
import { formatRate } from "../format";
import { streetRentPerMinute } from "../game/rent";
import { currentPrice } from "../game/plots";
import { ECONOMY } from "../config/economy";
import { useAllStreets } from "../store/useStreetContext";
import { formatPlace } from "../geo/streetSearch";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Straße eines Bot-Nachbarn – nur ansehen. */
export function NeighborStreetScreen() {
  const { streetId = "" } = useParams();
  const street = useGameStore((s) => s.neighborStreets[streetId]);
  const bot = useGameStore((s) => s.neighborhood?.bots.find((b) => b.streetId === streetId));
  const player = useGameStore((s) => s.player)!;
  const allStreets = useAllStreets();
  const navigate = useNavigate();
  const onViewport = useCallback(
    (from: number, to: number) => {
      if (street) sound.setAmbience(ambienceFor(street, from, to));
    },
    [street],
  );
  useEffect(() => () => sound.stopAmbience(), []);
  if (!street || !bot) return <Navigate to={routes.neighborhood} replace />;

  const built = street.plots.filter((p) => p.building).length;
  const mine = street.plots.filter((p) => p.ownerId === player.id);
  const free = street.plots.filter((p) => p.purchasedAt === undefined).length;

  return (
    <div className="street-screen">
      <Link className="btn btn-link back" to={routes.neighborhood}>
        ← Zur Nachbarschaft
      </Link>
      <div className="neighbor-head">
        <span className="neighbor-avatar" aria-hidden>
          {bot.avatar}
        </span>
        <div>
          <h1>{street.name}</h1>
          <p className="subtle">
            {formatPlace(street)} · gehört {bot.name} ({personaOf(bot.character)?.tagline})
          </p>
        </div>
      </div>
      <StreetView
        street={street}
        ownerName={personaOf(bot.character)?.shortName ?? bot.name}
        life
        onViewport={onViewport}
        mineId={player.id}
        coins={player.coins}
        priceOf={(plot) => currentPrice(allStreets, street, plot, player.id)}
        onSelect={(plot) => {
          sound.tap();
          navigate(routes.neighborPlot(street.id, plot.id));
        }}
        onCarTap={({ model }) => sound.horn(model.horn)}
      />
      {mine.length > 0 ? (
        <div className="card neighbor-mine">
          <strong>
            Du hast hier {mine.length} Grundstück{mine.length > 1 ? "e" : ""} · bringt dir 🪙 {formatRate(streetRentPerMinute(street, player.id))} pro Minute
          </strong>
        </div>
      ) : (
        free > 0 && (
          <p className="hint left">
            Tipp ein freies Grundstück an, um es zu kaufen – auch hier kannst du bauen (+{Math.round((ECONOMY.neighborPriceFactor - 1) * 100)} % Aufpreis
            beim Nachbarn).
          </p>
        )
      )}
      <p className="subtle">
        {built} von {street.plots.length} Grundstücken bebaut, {free} frei · {bot.name} verdient ca. 🪙 {formatRate(streetRentPerMinute(street))} pro
        Minute
      </p>
    </div>
  );
}
