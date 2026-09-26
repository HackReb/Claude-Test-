import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BuildPicker, type BuildMode } from "../components/BuildPicker";
import { FacadePreview } from "../components/FacadePreview";
import { ECONOMY } from "../config/economy";
import { formatCoins, formatRate } from "../format";
import { currentPrice, isOwned } from "../game/plots";
import { buildingRentPerMinute, streetRentPerMinute } from "../game/rent";
import type { Plot } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

export function PlotScreen() {
  const { plotId } = useParams();
  const street = useGameStore((s) => s.street)!;
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot) return <Navigate to={routes.street} replace />;

  const cfg = ECONOMY.plotSizes[plot.size];
  const where = `${plot.side === "left" ? "Obere" : "Untere"} Straßenseite, Platz ${plot.index + 1}`;

  return (
    <div className="plot-screen">
      <Link className="btn btn-link back" to={routes.street}>
        ← Zur Straße
      </Link>
      <h1>{plot.building ? plot.building.name : `Grundstück ${plot.size}`}</h1>
      <p className="subtle">
        {where} · {cfg.tiles} Kachel{cfg.tiles > 1 ? "n" : ""} breit · bis {cfg.maxFloors} Stockwerk
        {cfg.maxFloors > 1 ? "e" : ""}
      </p>

      {isOwned(plot) ? <OwnedPlot plot={plot} /> : <PlotForSale plot={plot} />}
    </div>
  );
}

function OwnedPlot({ plot }: { plot: Plot }) {
  const [mode, setMode] = useState<BuildMode | null>(null);
  const building = plot.building;

  if (mode) return <BuildPicker plot={plot} mode={mode} onDone={() => setMode(null)} />;

  const buildActions = (
    <div className="actions">
      <button type="button" className="btn" onClick={() => setMode("template")}>
        Vorlage
      </button>
      <button type="button" className="btn" onClick={() => setMode("random")}>
        Würfeln 🎲
      </button>
      <Link className="btn btn-primary" to={routes.builder(plot.id)}>
        Selbst bauen
      </Link>
    </div>
  );

  if (building) {
    return (
      <>
        <div className="card plot-preview">
          <FacadePreview facade={building.facade} size={plot.size} label={building.name} maxHeight={220} />
        </div>
        <ul className="facts">
          <li>
            Bringt <strong>🪙 {formatRate(buildingRentPerMinute(plot.size, building))} pro Minute</strong>
          </li>
          <li>Stufe {building.level} von 3</li>
        </ul>
        <h2>Umbauen</h2>
        <p className="subtle">Ersetzt {building.name}. Die Upgrade-Stufe bleibt erhalten.</p>
        {buildActions}
      </>
    );
  }

  return (
    <>
      <p>
        Dein Bauplatz ist bereit. Ein Gebäude hier bringt ab{" "}
        <strong>🪙 {ECONOMY.plotSizes[plot.size].baseRentPerMinute} pro Minute</strong>.
      </p>
      {buildActions}
    </>
  );
}

function PlotForSale({ plot }: { plot: Plot }) {
  const street = useGameStore((s) => s.street)!;
  const player = useGameStore((s) => s.player)!;
  const buyPlot = useGameStore((s) => s.buyPlot);
  const collect = useGameStore((s) => s.collect);
  const [busy, setBusy] = useState(false);

  const price = currentPrice(street, plot);
  const missing = price - player.coins;
  const pending = Math.floor(player.pendingRent);
  const rate = streetRentPerMinute(street);
  const basePrice = ECONOMY.plotSizes[plot.size].price;

  async function onBuy() {
    setBusy(true);
    try {
      await buyPlot(plot.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card price-card">
        <span className="subtle">Preis</span>
        <strong className="price">🪙 {formatCoins(price)}</strong>
        {price > basePrice && (
          <span className="subtle">
            Startpreis {formatCoins(basePrice)}, +{Math.round(ECONOMY.plotPriceIncrease * 100)} % je gekauftem Grundstück
          </span>
        )}
        <span className="subtle">Miete mit Gebäude: ab 🪙 {ECONOMY.plotSizes[plot.size].baseRentPerMinute} pro Minute</span>
      </div>

      <button type="button" className="btn btn-primary btn-wide" disabled={missing > 0 || busy} onClick={onBuy}>
        Kaufen für 🪙 {formatCoins(price)}
      </button>

      {missing > 0 && (
        <div className="missing">
          <p>
            Dir fehlen noch <strong>🪙 {formatCoins(missing)}</strong>.{" "}
            {pending >= missing
              ? "Deine gesammelte Miete reicht schon!"
              : rate > 0 && `Bei deiner Miete dauert das ca. ${Math.ceil((missing - pending) / rate)} Min.`}
          </p>
          {pending >= 1 && (
            <button type="button" className="btn" onClick={() => void collect()}>
              🪙 {formatCoins(pending)} Miete einsammeln
            </button>
          )}
        </div>
      )}
    </>
  );
}
