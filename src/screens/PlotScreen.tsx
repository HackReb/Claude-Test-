import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BuildPicker, type BuildMode } from "../components/BuildPicker";
import { BuildingNameField } from "../components/BuildingNameField";
import { useLabel } from "../components/UsePicker";
import { Playground } from "../components/street/Playground";
import { sound } from "../audio/sound";
import { MISCHIEF } from "../config/badboys";
import { CAR_OUTINGS } from "../config/pets";
import { LIFE } from "../config/life";
import { occupancyOf, streetNeeds, targetOccupancy, useOf } from "../game/life";
import { possessive } from "../game/names";
import { FacadePreview } from "../components/FacadePreview";
import { capacityOf, ECONOMY, upkeepOf } from "../config/economy";
import { formatCoins, formatDuration, formatRate } from "../format";
import { belongsTo, currentPrice, isOwned, nextUpgrade } from "../game/plots";
import { playerIncomePerHour, plotIncomePerHour, plotUpkeepPerHour } from "../game/rent";
import type { Building, Plot, Street } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";
import { useAllStreets, useStreetContext, type StreetContext } from "../store/useStreetContext";

export function PlotScreen() {
  const { plotId, streetId } = useParams();
  const ctx = useStreetContext(streetId);
  const playerId = useGameStore((s) => s.player!.id);
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


      {mine ? (
        <OwnedPlot plot={plot} ctx={ctx} />
      ) : isOwned(plot) ? (
        <ForeignPlot plot={plot} ctx={ctx} />
      ) : ctx.own ? (
        <PlotForSale plot={plot} ctx={ctx} />
      ) : (
        <p>
          Dieses Grundstück ist noch frei – kaufen kann hier aber nur {ctx.ownerName || "der Besitzer der Straße"}. Du baust in deiner eigenen
          Straße.
        </p>
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
      {plot.building && (
        <ul className="facts">
          <OccupancyFacts street={ctx.street} plot={plot as Plot & { building: Building }} />
        </ul>
      )}
      <p>
        Gehört <strong>{ctx.bot ? `${ctx.bot.avatar} ${ctx.bot.name}` : plot.ownerId && plot.ownerId !== ctx.street.ownerId ? "einem anderen Mitspieler" : ctx.own ? "einem Mitspieler" : ctx.ownerName || "deinem Nachbarn"}</strong> und ist nicht zu verkaufen. Freie Grundstücke in dieser Straße kannst du kaufen und selbst
        bebauen.
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
            <strong>{useLabel(useOf(building))}</strong> · Stufe {building.level} von 3
          </li>
          <OccupancyFacts street={street} plot={plot as Plot & { building: Building }} />
          <li>
            Bringt jetzt <strong>🪙 {formatRate(plotIncomePerHour(street, plot))} pro Stunde</strong>
            <span className="subtle"> · Kosten 🪙 {formatRate(plotUpkeepPerHour(plot))}/Std.</span>
          </li>
        </ul>
        {ctx.own && (building.graffiti || building.damaged || !!building.soot) && <DamageSection plot={plot} />}
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
          Die Kinder lieben ihn! Ohne Spielplatz würden sich die Wohnhäuser deiner Straße nur zu{" "}
          {Math.round(LIFE.noPlaygroundFactor * 100)} % füllen. Kosten: 🪙 {formatRate(ECONOMY.playgroundUpkeepPerHour)}/Std. für die Pflege.
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
        {ctx.own ? "Dein Bauplatz ist bereit." : `Dein Bauplatz in ${possessive(ctx.ownerName)} ${street.name} ist bereit.`} Ein Wohnhaus hier
        hat Platz für <strong>{capacityOf(plot.size, 1)} Bewohner</strong>, ein Laden für {capacityOf(plot.size, 1)} Kunden gleichzeitig.
        Laufende Kosten: 🪙 {formatRate(upkeepOf(plot.size, 1))}/Std.
      </p>
      {buildActions}
      {ctx.own && <PlaygroundOffer plot={plot} />}
    </>
  );
}

/** Bewohner bzw. Kundschaft eines Gebäudes, und ob gerade Leute ein- oder ausziehen – und warum. */
function OccupancyFacts({ street, plot }: { street: Street; plot: Plot & { building: Building } }) {
  const places = capacityOf(plot.size, plot.building.level);
  const now = occupancyOf(street, plot);
  const target = targetOccupancy(street, plot);
  const home = useOf(plot.building) === "residential";
  const missing = home ? streetNeeds(street).filter((n) => !n.met).map((n) => n.label) : [];
  const trend =
    target > now + 0.01 ? "↗ Es ziehen gerade Leute ein." : target < now - 0.01 ? "↘ Es ziehen gerade Leute aus!" : "Stabil.";
  return (
    <li>
      {home ? (
        <>
          👥 <strong>{Math.round(now * places)} von {places} Bewohnern</strong>
        </>
      ) : (
        <>
          🛒 <strong>{Math.round(now * 100)} % ausgelastet</strong> ({places} Kundenplätze)
        </>
      )}{" "}
      <span className="subtle">
        {trend}
        {missing.length > 0 && ` Es fehlt: ${missing.join(", ")}.`}
        {!home && target < 0.99 && " Mehr Bewohner in der Straße bringen mehr Kundschaft."}
      </span>
    </li>
  );
}

function PlaygroundOffer({ plot }: { plot: Plot }) {
  const coins = useGameStore((s) => s.player!.coins);
  const buildPlayground = useGameStore((s) => s.buildPlayground);
  return (
    <div className="card upgrade-card">
      <h2>🛝 Spielplatz anlegen</h2>
      <p className="subtle">
        Statt eines Hauses: Ohne Spielplatz füllen sich Wohnhäuser nur zu {Math.round(LIFE.noPlaygroundFactor * 100)} %. Pflege kostet 🪙{" "}
        {formatRate(ECONOMY.playgroundUpkeepPerHour)}/Std.
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

/** Was Bad Boys angerichtet haben: wegschrubben bzw. reparieren. */
function DamageSection({ plot }: { plot: Plot }) {
  const coins = useGameStore((s) => s.player!.coins);
  const scrub = useGameStore((s) => s.scrubGraffiti);
  const wash = useGameStore((s) => s.washFacade);
  const repair = useGameStore((s) => s.repair);
  const building = plot.building!;
  const repairCost = MISCHIEF.repairCost[plot.size];
  return (
    <div className="card damage-card">
      {building.graffiti && (
        <>
          <p>
            🎨 Jemand hat <strong>„{building.graffiti}“</strong> an die Wand gesprüht. Die Nachbarn finden das gar nicht lustig.
          </p>
          <button
            type="button"
            className="btn"
            disabled={coins < MISCHIEF.scrubCost}
            onClick={async () => {
              if ((await scrub(plot.id)).ok) sound.sparkle();
              else sound.deny();
            }}
          >
            🧽 Wegschrubben für 🪙 {formatCoins(MISCHIEF.scrubCost)}
          </button>
        </>
      )}
      {!!building.soot && (
        <>
          <p>
            💨 Die Fassade ist voller Ruß ({building.soot}× – stört wie so viel Dreck). Da sind wohl Nachbarn mit ihren Stinkern durchgefahren.
          </p>
          <button
            type="button"
            className="btn"
            disabled={coins < CAR_OUTINGS.washCost}
            onClick={async () => {
              if ((await wash(plot.id)).ok) sound.sparkle();
              else sound.deny();
            }}
          >
            🚿 Fassade waschen für 🪙 {formatCoins(CAR_OUTINGS.washCost)}
          </button>
        </>
      )}
      {building.damaged && (
        <>
          <p>
            💥 Fenster kaputt! Solange nicht repariert ist, füllt sich das Haus höchstens zu {Math.round(MISCHIEF.damagedFactor * 100)} %.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={coins < repairCost}
            onClick={async () => {
              if ((await repair(plot.id)).ok) sound.build();
              else sound.deny();
            }}
          >
            🔧 Reparieren für 🪙 {formatCoins(repairCost)}
          </button>
        </>
      )}
    </div>
  );
}

function UpgradeSection({ plot, streetId }: { plot: Plot; streetId?: string }) {
  const coins = useGameStore((s) => s.player!.coins);
  const upgrade = useGameStore((s) => s.upgrade);
  const next = nextUpgrade(plot);
  if (!plot.building) return null;
  if (!next) return <p className="badge">⭐ Höchste Stufe erreicht</p>;

  const home = useOf(plot.building) === "residential";
  const placesNow = capacityOf(plot.size, plot.building.level);
  const placesNext = capacityOf(plot.size, next.level);
  return (
    <div className="card upgrade-card">
      <h2>Ausbauen auf Stufe {next.level}</h2>
      <p className="subtle">
        Platz für {placesNow} → <strong>{placesNext}</strong> {home ? "Bewohner" : "Kunden"} · Kosten 🪙{" "}
        {formatRate(upkeepOf(plot.size, plot.building.level))} → {formatRate(upkeepOf(plot.size, next.level))}/Std.
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

function PlotForSale({ plot, ctx }: { plot: Plot; ctx: StreetContext }) {
  const streets = useAllStreets();
  const player = useGameStore((s) => s.player)!;
  const buyPlot = useGameStore((s) => s.buyPlot);
  const collect = useGameStore((s) => s.collect);
  const [busy, setBusy] = useState(false);
  const [tooLate, setTooLate] = useState(false);

  const price = currentPrice(streets, ctx.street, plot, player.id);
  const missing = price - player.coins;
  const pending = Math.floor(player.pendingRent);
  const rate = playerIncomePerHour(streets, player.id);
  const basePrice = ECONOMY.plotSizes[plot.size].price;

  async function onBuy() {
    setBusy(true);
    try {
      const result = await buyPlot(plot.id, ctx.streetId);
      if (result.ok) {
        sound.cash();
      } else {
        sound.deny();
        if (result.reason === "taken") setTooLate(true);
      }
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
        <span className="subtle">
          Mit Gebäude: Platz für {capacityOf(plot.size, 1)} Bewohner oder Kunden · Kosten ab 🪙 {formatRate(upkeepOf(plot.size, 1))}/Std.
        </span>
      </div>

      <button type="button" className="btn btn-primary btn-wide" disabled={missing > 0 || busy} onClick={onBuy}>
        Kaufen für 🪙 {formatCoins(price)}
      </button>
      {tooLate && (
        <p className="error" role="status">
          Zu spät – jemand war schneller! Dein Geld hast du zurück.
        </p>
      )}

      {missing > 0 && (
        <div className="missing">
          <p>
            Dir fehlen noch <strong>🪙 {formatCoins(missing)}</strong>.{" "}
            {pending >= missing
              ? "Deine gesammelte Miete reicht schon!"
              : rate > 0 && `Bei deinen Einnahmen dauert das ca. ${formatDuration((missing - pending) / rate)}.`}
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
