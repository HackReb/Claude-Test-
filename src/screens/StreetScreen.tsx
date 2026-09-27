import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountCard } from "../components/AccountCard";
import { SecurityCard } from "../components/SecurityCard";
import { WellbeingCard } from "../components/WellbeingCard";
import { ambienceFor } from "../audio/ambience";
import { sound } from "../audio/sound";
import { Voices } from "../components/Voices";
import { residentVoices, type Voice } from "../game/life";
import type { LitterItem } from "../model/types";
import { Link, useNavigate } from "react-router-dom";
import { RentBar } from "../components/RentBar";
import { StreetSearch } from "../components/StreetSearch";
import { StreetView } from "../components/street/StreetView";
import { formatCoins } from "../format";
import { currentPrice } from "../game/plots";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";
import { useAllStreets } from "../store/useStreetContext";

export function StreetScreen() {
  const street = useGameStore((s) => s.street)!;
  const player = useGameStore((s) => s.player)!;
  const offlineReport = useGameStore((s) => s.offlineReport);
  const paper = useGameStore((s) => s.neighborhood?.paper);
  const dismissOfflineReport = useGameStore((s) => s.dismissOfflineReport);
  const collect = useGameStore((s) => s.collect);
  const reset = useGameStore((s) => s.reset);
  const navigate = useNavigate();
  const verifyStreet = useGameStore((s) => s.verifyStreet);
  const cleanLitter = useGameStore((s) => s.cleanLitter);
  const allStreets = useAllStreets();
  const dropLitter = useGameStore((s) => s.dropLitter);
  const [confirmReset, setConfirmReset] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [honk, setHonk] = useState<string | null>(null);

  const voices = useMemo(() => residentVoices(street), [street]);

  // Neue Wünsche/Beschwerden kündigen sich mit einem kleinen Ton an.
  const knownVoices = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(voices.map((v) => v.id));
    if (knownVoices.current && [...ids].some((id) => !knownVoices.current!.has(id))) sound.bubble();
    knownVoices.current = ids;
  }, [voices]);

  // Straßengeräusche passend zum sichtbaren Ausschnitt; beim Verlassen Ruhe.
  const viewport = useRef<[number, number]>([0, 0.4]);
  const streetRef = useRef(street);
  streetRef.current = street;
  const onViewport = useCallback((from: number, to: number) => {
    viewport.current = [from, to];
    sound.setAmbience(ambienceFor(streetRef.current, from, to));
  }, []);
  useEffect(() => {
    sound.setAmbience(ambienceFor(street, ...viewport.current));
  }, [street]);
  useEffect(() => () => sound.stopAmbience(), []);

  async function onLitterTap(item: LitterItem): Promise<number> {
    const result = await cleanLitter(item.id);
    if (!result) return 0;
    if (!result.cleaned) sound.scrub();
    else {
      sound.pickup();
      if (result.kind === "poop") sound.sparkle();
      sound.coin(0.15);
    }
    return result.reward;
  }

  function onVoice(voice: Voice) {
    sound.bubble();
    setHighlight(voice.id);
    document.getElementById("voices")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 1800);
  }

  return (
    <div className="street-screen">
      {offlineReport !== null && (
        <div className="notice card" role="status">
          <p>
            Willkommen zurück, {player.name}! Während du weg warst: <strong>+🪙 {formatCoins(offlineReport.income)}</strong> Miete,{" "}
            <strong>−🪙 {formatCoins(offlineReport.upkeep)}</strong> laufende Kosten.
            {Math.round(offlineReport.movedIn) > 0 && ` ${Math.round(offlineReport.movedIn)} Bewohner eingezogen.`}
            {Math.round(offlineReport.movedOut) > 0 && ` 😢 ${Math.round(offlineReport.movedOut)} Bewohner ausgezogen – kümmer dich um deine Straße!`}
          </p>
          {!!offlineReport.refund && (
            <p>
              Neu: Gekauft wird nur noch in deiner eigenen Straße. Deine Grundstücke bei Nachbarn wurden erstattet:{" "}
              <strong>+🪙 {formatCoins(offlineReport.refund)}</strong> aufs Konto.
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                const amount = await collect();
                if (amount > 0) sound.coins(amount);
              }}
            >
              Einsammeln
            </button>
            <button type="button" className="btn btn-link" onClick={dismissOfflineReport}>
              Später
            </button>
          </div>
        </div>
      )}

      {!street.osm && (
        <div className="notice card">
          {verifying ? (
            <>
              <StreetSearch
                label="Deine Straße auf der Karte"
                initialQuery={`${street.name} ${street.city}`}
                onSelect={async (location) => {
                  if (await verifyStreet(location)) setVerifying(false);
                }}
              />
              <button type="button" className="btn btn-link" onClick={() => setVerifying(false)}>
                Abbrechen
              </button>
            </>
          ) : (
            <>
              <p>
                <strong>{street.name}</strong> ist noch <strong>ungeprüft</strong>. Bestätige sie auf der Karte, damit sie als echte
                Straße zählt.
              </p>
              <button type="button" className="btn" onClick={() => setVerifying(true)}>
                Auf der Karte bestätigen
              </button>
            </>
          )}
        </div>
      )}

      <StreetView
        street={street}
        ownerName={player.name}
        coins={player.coins}
        priceOf={(plot) => currentPrice(allStreets, street, plot, player.id)}
        onSelect={(plot) => {
          sound.tap();
          navigate(routes.plot(plot.id));
        }}
        life
        onLitterTap={onLitterTap}
        onDrop={(kind, spot) => void dropLitter(kind, spot)}
        voices={voices}
        onVoice={onVoice}
        onViewport={onViewport}
        cars={player.cars}
        onCarTap={({ model, car }) => {
          sound.horn(model.horn);
          setHonk(car ? `📯 ${car.name} (${car.plate}) hupt!` : `📯 ${model.brand} ${model.model} hupt zurück!`);
          setTimeout(() => setHonk(null), 2200);
        }}
      />
      {honk && (
        <p className="honk" role="status">
          {honk}
        </p>
      )}
      <p className="hint street-hint">Wisch zur Seite für die ganze Straße · tipp ein Grundstück an · Müll und 💩 wegtippen!</p>

      {paper && !paper.read && paper.issue.stories[0] && (
        <Link className="card paper-teaser" to={routes.paper}>
          <span aria-hidden>📰</span>
          <span>
            <small>Neu im Babo-Anzeiger</small>
            <strong>{paper.issue.stories[0].headline}</strong>
          </span>
        </Link>
      )}
      <RentBar />
      <WellbeingCard street={street} playerId={player.id} />
      <SecurityCard street={street} />

      <Link className="card garage-link" to={routes.garage}>
        <span aria-hidden>🚗</span>
        <span>
          <strong>Autohaus Babo</strong>
          <small>
            {player.cars?.length
              ? `${player.cars.length} Auto${player.cars.length > 1 ? "s" : ""} in deiner Garage`
              : "Kauf dir dein erstes Auto – mit eigenem Nummernschild"}
          </small>
        </span>
      </Link>

      <Voices voices={voices} highlight={highlight} />

      <AccountCard />

      {/* Bestätigung im Screen statt confirm(): der blockiert auf Mobile und in eingebetteten Ansichten. */}
      {confirmReset ? (
        <div className="confirm">
          <p>Spielstand wirklich löschen und neu anfangen?</p>
          <div className="actions">
            <button type="button" className="btn btn-danger" onClick={() => void reset()}>
              Ja, löschen
            </button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-link" onClick={() => setConfirmReset(true)}>
          Spielstand zurücksetzen
        </button>
      )}
    </div>
  );
}
