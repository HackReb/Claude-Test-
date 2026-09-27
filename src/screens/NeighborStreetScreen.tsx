import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ambienceFor } from "../audio/ambience";
import { sound } from "../audio/sound";
import { BadBoysCard } from "../components/BadBoysCard";
import { StreetView } from "../components/street/StreetView";
import { personaOf } from "../config/bots";
import { formatRate } from "../format";
import { streetIncomePerHour } from "../game/rent";
import { residentsOf } from "../game/life";
import { formatPlace } from "../geo/streetSearch";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Wie oft die angesehene Straße eines Mitspielers neu geladen wird. */
const LIVE_REFRESH_MS = 20_000;

/** Straße eines Nachbarn – Bot oder echter Mitspieler. Freie Grundstücke kann man kaufen. */
export function NeighborStreetScreen() {
  const { streetId = "" } = useParams();
  const street = useGameStore((s) => s.neighborStreets[streetId] ?? s.playerStreets[streetId]);
  const bot = useGameStore((s) => s.neighborhood?.bots.find((b) => b.streetId === streetId));
  const realOwner = useGameStore((s) => s.ownerNames[streetId]);
  const loadPlayerStreet = useGameStore((s) => s.loadPlayerStreet);
  const [lookup, setLookup] = useState<"loading" | "done">(street ? "done" : "loading");
  const player = useGameStore((s) => s.player)!;
  const navigate = useNavigate();
  const onViewport = useCallback(
    (from: number, to: number) => {
      if (street) sound.setAmbience(ambienceFor(street, from, to));
    },
    [street],
  );
  useEffect(() => () => sound.stopAmbience(), []);
  // Straße eines Mitspielers: fast live mitverfolgen, was dort passiert.
  const refreshStreet = useGameStore((s) => s.refreshStreet);
  const live = !bot && !!realOwner;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void refreshStreet(streetId), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, refreshStreet, streetId]);
  // Straße eines Mitspielers (z. B. per Link) erst vom Server holen.
  useEffect(() => {
    if (lookup === "loading") void loadPlayerStreet(streetId).finally(() => setLookup("done"));
  }, [lookup, loadPlayerStreet, streetId]);

  if (!street && lookup === "loading") return <p className="subtle">Straße wird geladen …</p>;
  const owner = bot
    ? { avatar: bot.avatar, name: bot.name, shortName: personaOf(bot.character)?.shortName ?? bot.name, about: personaOf(bot.character)?.tagline }
    : realOwner
      ? { avatar: "🧑", name: realOwner, shortName: realOwner, about: "echter Mitspieler" }
      : null;
  if (!street || !owner) return <Navigate to={routes.neighborhood} replace />;

  const built = street.plots.filter((p) => p.building).length;
  const free = street.plots.filter((p) => p.purchasedAt === undefined).length;

  return (
    <div className="street-screen">
      <Link className="btn btn-link back" to={routes.neighborhood}>
        ← Zur Nachbarschaft
      </Link>
      <div className="neighbor-head">
        <span className="neighbor-avatar" aria-hidden>
          {owner.avatar}
        </span>
        <div>
          <h1>{street.name}</h1>
          <p className="subtle">
            {formatPlace(street)} · 👥 {Math.round(residentsOf(street))} Bewohner · gehört {owner.name} ({owner.about})
          </p>
        </div>
      </div>
      <StreetView
        street={street}
        ownerName={owner.shortName}
        life
        onViewport={onViewport}
        mineId={player.id}
        coins={player.coins}
        onSelect={(plot) => {
          sound.tap();
          navigate(routes.neighborPlot(street.id, plot.id));
        }}
        onCarTap={({ model }) => sound.horn(model.horn)}
      />
      <BadBoysCard streetId={street.id} streetName={street.name} />
      <p className="subtle">
        {built} von {street.plots.length} Grundstücken bebaut, {free} frei · {owner.name} verdient ca. 🪙 {formatRate(streetIncomePerHour(street))} pro
        Stunde
      </p>
    </div>
  );
}
