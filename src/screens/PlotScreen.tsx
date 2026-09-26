import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BuildPicker, type BuildMode } from "../components/BuildPicker";
import { BuildingNameField } from "../components/BuildingNameField";
import { useLabel } from "../components/UsePicker";
import { Playground } from "../components/street/Playground";
import { sound } from "../audio/sound";
import { LIFE } from "../config/life";
import { rentModifiers, useOf } from "../game/life";
import { FacadePreview } from "../components/FacadePreview";
import { ECONOMY } from "../config/economy";
import { formatCoins, formatRate } from "../format";
import { currentPrice, isOwned, nextUpgrade } from "../game/plots";
import { buildingRentPerMinute, plotRentPerMinute, streetRentPerMinute } from "../game/rent";
import type { BuildingUse, Plot, Street } from "../model/types";
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
      {plot.building ? (
        <BuildingTitle plotId={plot.id} name={plot.building.name} />
      ) : (
        <h1>{isOwned(plot) && plot.amenity === "playground" ? "Spielplatz" : `Grundstück ${plot.size}`}</h1>
      )}
      <p className="subtle">
        {where} · {cfg.tiles} Kachel{cfg.tiles > 1 ? "n" : ""} breit · bis {cfg.maxFloors} Stockwerk
        {cfg.maxFloors > 1 ? "e" : ""}
      </p>

      {isOwned(plot) ? <OwnedPlot plot={plot} /> : <PlotForSale plot={plot} />}
    </div>
  );
}

/** Gebäudename als Überschrift, per Stift umbenennbar. */
function BuildingTitle({ plotId, name }: { plotId: string; name: string }) {
  const rename = useGameStore((s) => s.renameBuilding);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <div className="title-row">
        <h1>{name}</h1>
        <button type="button" className="btn btn-link" onClick={() => setDraft(name)} aria-label={`${name} umbenennen`}>
          ✏️ Umbenennen
        </button>
      </div>
    );
  }
  return (
    <form
      className="rename"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await rename(plotId, draft)) setDraft(null);
      }}
    >
      <BuildingNameField value={draft} onChange={setDraft} />
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          Speichern
        </button>
        <button type="button" className="btn btn-link" onClick={() => setDraft(null)}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function OwnedPlot({ plot }: { plot: Plot }) {
  const street = useGameStore((s) => s.street)!;
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
            <strong>{useLabel(useOf(building))}</strong>
          </li>
          <li>
            Bringt <strong>🪙 {formatRate(plotRentPerMinute(street, plot))} pro Minute</strong>
            {Math.abs(plotRentPerMinute(street, plot) - buildingRentPerMinute(plot.size, building)) > 0.05 && (
              <span className="subtle"> (Grundmiete {formatRate(buildingRentPerMinute(plot.size, building))}, {rentNote(street, useOf(building))})</span>
            )}
          </li>
          <li>Stufe {building.level} von 3</li>
        </ul>
        <UpgradeSection plot={plot} />
        <h2>Umbauen</h2>
        <p className="subtle">Ersetzt {building.name}. Die Upgrade-Stufe bleibt erhalten.</p>
        {buildActions}
      </>
    );
  }

  if (plot.amenity === "playground") {
    return (
      <>
        <div className="card plot-preview">
          <svg viewBox="-70 -70 140 80" style={{ maxHeight: 180 }} role="img" aria-label="Spielplatz">
            <Playground width={140} groundY={0} />
          </svg>
        </div>
        <p>
          Die Kinder lieben ihn! Alle Wohnhäuser deiner Straße zahlen <strong>+{Math.round(LIFE.playgroundBonus * 100)} % Miete</strong>.
        </p>
        <h2>Umbauen</h2>
        <p className="subtle">Ein Gebäude ersetzt den Spielplatz.</p>
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
      <PlaygroundOffer plot={plot} />
    </>
  );
}

/** Kurz erklären, warum die Miete von der Grundmiete abweicht. */
function rentNote(street: Street, use: BuildingUse): string {
  const m = rentModifiers(street);
  const parts = [];
  const bonus = use === "residential" ? m.playgroundBonus : m.customerBonus;
  if (bonus > 0) parts.push(`+${Math.round(bonus * 100)} % ${use === "residential" ? "Spielplatz" : "Kundschaft"}`);
  if (m.cleanliness < 1) parts.push(`−${Math.round((1 - m.cleanliness) * 100)} % Dreck`);
  return parts.join(", ");
}

function PlaygroundOffer({ plot }: { plot: Plot }) {
  const coins = useGameStore((s) => s.player!.coins);
  const buildPlayground = useGameStore((s) => s.buildPlayground);
  return (
    <div className="card upgrade-card">
      <h2>🛝 Spielplatz anlegen</h2>
      <p className="subtle">
        Statt eines Hauses: Die Kinder freuen sich, alle Wohnhäuser zahlen +{Math.round(LIFE.playgroundBonus * 100)} % Miete.
      </p>
      <button
        type="button"
        className="btn"
        disabled={coins < LIFE.playgroundCost}
        onClick={async () => {
          const result = await buildPlayground(plot.id);
          if (result.ok) sound.build();
          else sound.deny();
        }}
      >
        Anlegen für 🪙 {formatCoins(LIFE.playgroundCost)}
      </button>
    </div>
  );
}

function UpgradeSection({ plot }: { plot: Plot }) {
  const coins = useGameStore((s) => s.player!.coins);
  const upgrade = useGameStore((s) => s.upgrade);
  const next = nextUpgrade(plot);
  if (!plot.building) return null;
  if (!next) return <p className="badge">⭐ Höchste Stufe erreicht</p>;

  const rentNow = buildingRentPerMinute(plot.size, plot.building);
  const rentNext = buildingRentPerMinute(plot.size, { ...plot.building, level: next.level });
  return (
    <div className="card upgrade-card">
      <h2>Ausbauen auf Stufe {next.level}</h2>
      <p className="subtle">
        Miete ×{formatRate(ECONOMY.upgradeLevels[next.level].multiplier)}: 🪙 {formatRate(rentNow)} → <strong>{formatRate(rentNext)}</strong> pro
        Minute
      </p>
      <button type="button" className="btn btn-primary" disabled={coins < next.cost} onClick={async () => {
          if ((await upgrade(plot.id)).ok) sound.upgrade();
        }}>
        Ausbauen für 🪙 {formatCoins(next.cost)}
      </button>
      {coins < next.cost && <p className="subtle">Dir fehlen noch 🪙 {formatCoins(next.cost - coins)}.</p>}
    </div>
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
      const result = await buyPlot(plot.id);
      if (result.ok) sound.cash();
      else sound.deny();
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
