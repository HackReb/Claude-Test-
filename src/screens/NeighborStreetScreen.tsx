import { useCallback, useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ambienceFor } from "../audio/ambience";
import { sound } from "../audio/sound";
import { StreetView } from "../components/street/StreetView";
import { personaOf } from "../config/bots";
import { formatRate } from "../format";
import { streetRentPerMinute } from "../game/rent";
import { formatPlace } from "../geo/streetSearch";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Straße eines Bot-Nachbarn – nur ansehen. */
export function NeighborStreetScreen() {
  const { streetId = "" } = useParams();
  const street = useGameStore((s) => s.neighborStreets[streetId]);
  const bot = useGameStore((s) => s.neighborhood?.bots.find((b) => b.streetId === streetId));
  const onViewport = useCallback(
    (from: number, to: number) => {
      if (street) sound.setAmbience(ambienceFor(street, from, to));
    },
    [street],
  );
  useEffect(() => () => sound.stopAmbience(), []);
  if (!street || !bot) return <Navigate to={routes.neighborhood} replace />;

  const built = street.plots.filter((p) => p.building).length;

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
      <StreetView street={street} ownerName={personaOf(bot.character)?.shortName ?? bot.name} life onViewport={onViewport} />
      <p className="subtle">
        {built} von {street.plots.length} Grundstücken bebaut · verdient ca. 🪙 {formatRate(streetRentPerMinute(street))} pro Minute
      </p>
    </div>
  );
}
