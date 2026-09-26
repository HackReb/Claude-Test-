import { Link, Navigate, useParams } from "react-router-dom";
import { Placeholder } from "../components/Placeholder";
import { ECONOMY } from "../config/economy";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

export function PlotScreen() {
  const { plotId } = useParams();
  const plot = useGameStore((s) => s.street?.plots.find((p) => p.id === plotId));
  if (!plot) return <Navigate to={routes.street} replace />;

  const owned = plot.purchasedAt !== undefined;
  const cfg = ECONOMY.plotSizes[plot.size];

  return (
    <Placeholder title={`Grundstück ${plot.size}`} milestone="M2/M3: Kaufen, Gebäude wählen, Upgraden">
      <ul className="facts">
        <li>Breite: {cfg.tiles} Kachel{cfg.tiles > 1 ? "n" : ""}</li>
        <li>Seite: {plot.side === "left" ? "links" : "rechts"}, Platz {plot.index + 1}</li>
        <li>Basismiete: 🪙 {cfg.baseRentPerMinute}/min</li>
        <li>{owned ? "Gehört dir ✅" : `Preis: 🪙 ${plot.price.toLocaleString("de-DE")}`}</li>
      </ul>
      {owned ? (
        <div className="actions">
          <button className="btn" disabled>Vorlage</button>
          <button className="btn" disabled>Würfeln 🎲</button>
          <Link className="btn btn-primary" to={routes.builder(plot.id)}>Selbst bauen</Link>
        </div>
      ) : (
        <button className="btn btn-primary" disabled>Kaufen</button>
      )}
      <Link className="btn btn-link" to={routes.street}>← Zurück zur Straße</Link>
    </Placeholder>
  );
}
