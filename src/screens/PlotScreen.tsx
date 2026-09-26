import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BuildPicker, type BuildMode } from "../components/BuildPicker";
import { BuildingNameField } from "../components/BuildingNameField";
import { useLabel } from "../components/UsePicker";
import { Playground } from "../components/street/Playground";
import { sound } from "../audio/sound";
import { LIFE } from "../config/life";
import { rentModifiers, useOf } from "../game/life";
import { possessive } from "../game/names";
import { FacadePreview } from "../components/FacadePreview";
import { ECONOMY } from "../config/economy";
import { formatCoins, formatRate } from "../format";
import { belongsTo, currentPrice, isOwned, nextUpgrade } from "../game/plots";
import { buildingRentPerMinute, playerRentPerMinute, plotRentPerMinute } from "../game/rent";
import type { BuildingUse, Plot, Street } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";
import { useAllStreets, useStreetContext, type StreetContext } from "../store/useStreetContext";

export function PlotScreen() {
  const { plotId, streetId } = useParams();
  const ctx = useStreetContext(streetId);
  const playerId = useGameStore((s) => s.player!.id);
  const [greeting, setGreeting] = useState<string | null>(null);
  const plot = ctx?.street.plots.find((p) => p.id === plotId);
  if (!ctx || !plot) return <Navigate to={ctx?.backRoute ?? routes.street} replace />;

  const cfg = ECONOMY.plotSizes[plot.size];
  const where = `${plot.side === "left" ? "Obere" : "Untere"} Straßenseite, Platz ${plot.index + 1}`;
  const mine = belongsTo(ctx.street, plot, playerId);
  const titleText = plot.building?.name ?? (isOwned(plot) && plot.amenity === "playground" ? "Spielplatz" : `Grundstück ${plot.size}`);

  return (
    <div className="plot-screen">
      <Link className="btn btn-link back" to={ctx.backRoute}>
        {ctx.backLabel}
      </Link>
      {plot.building && mine ? <BuildingTitle plotId={plot.id} name={plot.building.name} streetId={ctx.streetId} /> : <h1>{titleText}</h1>}
      <p className="subtle">
        {!ctx.own && `${ctx.street.name} (${ctx.bot?.name ?? "Nachbar"}) · `}
        {where} · {cfg.tiles} Kachel{cfg.tiles > 1 ? "n" : ""} breit · bis {cfg.maxFloors} Stockwerk
        {cfg.maxFloors > 1 ? "e" : ""}
      </p>

      {greeting && (
        <div className="notice card greeting" role="status">
          <p>{greeting}</p>
        </div>
      )}

      {mine ? (
        <OwnedPlot plot={plot} ctx={ctx} />
      ) : isOwned(plot) ? (
        <ForeignPlot plot={plot} ctx={ctx} />
      ) : (
        <PlotForSale plot={plot} ctx={ctx} onGreeting={setGreeting} />
      )}
    </div>
  );
}

/** Grundstück, das einem Nachbarn gehört – nur ansehen. */
function ForeignPlot({ plot, ctx }: { plot: Plot; ctx: StreetContext }) {
  return (
    <>
      {plot.building && (
        <div className="card plot-preview">
          <FacadePreview facade={plot.building.facade} size={plot.size} label={plot.building.name} maxHeight={220} />
        </div>
      )}
      <p>
        Gehört <strong>{ctx.bot ? `${ctx.bot.avatar} ${ctx.bot.name}` : "deinem Nachbarn"}</strong> und ist nicht zu verkaufen. Freie
        Grundstücke in dieser Straße kannst du kaufen und selbst bebauen.
      </p>
    </>
  );
}

/** Gebäudename als Überschrift, per Stift umbenennbar. */
function BuildingTitle({ plotId, name, streetId }: { plotId: string; name: string; streetId?: string }) {
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
        if (await rename(plotId, draft, streetId)) setDraft(null);
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

function OwnedPlot({ plot, ctx }: { plot: Plot; ctx: StreetContext }) {
  const street = ctx.street;
  const [mode, setMode] = useState<BuildMode | null>(null);
  const building = plot.building;

  if (mode) return <BuildPicker plot={plot} mode={mode} streetId={ctx.streetId} onDone={() => setMode(null)} />;

  const buildActions = (
    <div className="actions">
      <button type="button" className="btn" onClick={() => setMode("template")}>
        Vorlage
      </button>
      <button type="button" className="btn" onClick={() => setMode("random")}>
        Würfeln 🎲
      </button>
      <Link className="btn btn-primary" to={ctx.builderRoute(plot.id)}>
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
        <UpgradeSection plot={plot} streetId={ctx.streetId} />
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
        {ctx.own ? "Dein Bauplatz ist bereit." : `Dein Bauplatz in ${possessive(ctx.ownerName)} ${street.name} ist bereit.`} Ein Gebäude hier
        bringt ab{" "}
        <strong>🪙 {ECONOMY.plotSizes[plot.size].baseRentPerMinute} pro Minute</strong>.
      </p>
      {buildActions}
      {ctx.own && <PlaygroundOffer plot={plot} />}
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

function UpgradeSection({ plot, streetId }: { plot: Plot; streetId?: string }) {
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
          if ((await upgrade(plot.id, streetId)).ok) sound.upgrade();
        }}>
        Ausbauen für 🪙 {formatCoins(next.cost)}
      </button>
      {coins < next.cost && <p className="subtle">Dir fehlen noch 🪙 {formatCoins(next.cost - coins)}.</p>}
    </div>
  );
}

function PlotForSale({ plot, ctx, onGreeting }: { plot: Plot; ctx: StreetContext; onGreeting: (text: string) => void }) {
  const streets = useAllStreets();
  const player = useGameStore((s) => s.player)!;
  const buyPlot = useGameStore((s) => s.buyPlot);
  const collect = useGameStore((s) => s.collect);
  const [busy, setBusy] = useState(false);

  const price = currentPrice(streets, ctx.street, plot, player.id);
  const missing = price - player.coins;
  const pending = Math.floor(player.pendingRent);
  const rate = playerRentPerMinute(streets, player.id);
  const basePrice = ECONOMY.plotSizes[plot.size].price;

  async function onBuy() {
    setBusy(true);
    try {
      const result = await buyPlot(plot.id, ctx.streetId);
      if (result.ok) {
        sound.cash();
        if (result.greeting) {
          onGreeting(result.greeting);
          sound.bubble();
        }
      } else sound.deny();
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
            {!ctx.own && `, +${Math.round((ECONOMY.neighborPriceFactor - 1) * 100)} % Aufpreis beim Nachbarn`}
          </span>
        )}
        {!ctx.own && (
          <span className="subtle">
            Gehört dann dir – mitten in {possessive(ctx.ownerName)} {ctx.street.name}. Die Miete geht an dich.
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
