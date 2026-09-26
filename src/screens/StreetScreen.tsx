import { Link } from "react-router-dom";
import { Placeholder } from "../components/Placeholder";
import type { Plot } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

function PlotTile({ plot }: { plot: Plot }) {
  const owned = plot.purchasedAt !== undefined;
  return (
    <Link to={routes.plot(plot.id)} className={`plot-tile size-${plot.size} ${owned ? "owned" : ""}`}>
      <strong>{plot.size}</strong>
      <span>{owned ? "Deins" : `🪙 ${plot.price.toLocaleString("de-DE")}`}</span>
    </Link>
  );
}

export function StreetScreen() {
  const street = useGameStore((s) => s.street)!;
  const player = useGameStore((s) => s.player)!;
  const reset = useGameStore((s) => s.reset);

  const side = (s: Plot["side"]) =>
    street.plots.filter((p) => p.side === s).sort((a, b) => a.index - b.index);

  function onReset() {
    if (confirm("Spielstand wirklich löschen und neu anfangen?")) void reset();
  }

  return (
    <Placeholder title={`Moin, ${player.name}!`} milestone="M2: Straßen-Ansicht als SVG, Kaufen & Miete">
      <p>Deine Straße hat {street.plots.length} Grundstücke. Tipp eins an:</p>
      <div className="street-draft">
        <div className="street-side">{side("left").map((p) => <PlotTile key={p.id} plot={p} />)}</div>
        <div className="street-road" aria-hidden />
        <div className="street-side">{side("right").map((p) => <PlotTile key={p.id} plot={p} />)}</div>
      </div>
      <button type="button" className="btn btn-link" onClick={onReset}>
        Spielstand zurücksetzen
      </button>
    </Placeholder>
  );
}
