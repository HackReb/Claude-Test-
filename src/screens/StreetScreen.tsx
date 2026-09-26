import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RentBar } from "../components/RentBar";
import { StreetSearch } from "../components/StreetSearch";
import { StreetView } from "../components/street/StreetView";
import { formatCoins } from "../format";
import { currentPrice } from "../game/plots";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

export function StreetScreen() {
  const street = useGameStore((s) => s.street)!;
  const player = useGameStore((s) => s.player)!;
  const offlineEarnings = useGameStore((s) => s.offlineEarnings);
  const dismissOfflineEarnings = useGameStore((s) => s.dismissOfflineEarnings);
  const collect = useGameStore((s) => s.collect);
  const reset = useGameStore((s) => s.reset);
  const navigate = useNavigate();
  const verifyStreet = useGameStore((s) => s.verifyStreet);
  const [confirmReset, setConfirmReset] = useState(false);
  const [verifying, setVerifying] = useState(false);

  return (
    <div className="street-screen">
      {offlineEarnings !== null && (
        <div className="notice card" role="status">
          <p>
            Willkommen zurück, {player.name}! Während du weg warst, hat deine Straße{" "}
            <strong>🪙 {formatCoins(offlineEarnings)}</strong> Miete verdient.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => void collect()}>
              Einsammeln
            </button>
            <button type="button" className="btn btn-link" onClick={dismissOfflineEarnings}>
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
        coins={player.coins}
        priceOf={(plot) => currentPrice(street, plot)}
        onSelect={(plot) => navigate(routes.plot(plot.id))}
      />
      <p className="hint street-hint">Wisch zur Seite für die ganze Straße · tipp ein Grundstück an</p>

      <RentBar />

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
