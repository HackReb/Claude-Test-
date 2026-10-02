import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sound } from "../../audio/sound";
import { Sheet } from "../components/Sheet";
import type { StreetListing } from "../model/types";
import { useV2 } from "../store";

/** Bummeln: andere Straßen ansehen, in deren Mall stöbern und dort einkaufen. */
export function BummelnSheet() {
  const navigate = useNavigate();
  const home = useV2((s) => s.street)!;
  const visiting = useV2((s) => s.visiting);
  const loadStreets = useV2((s) => s.loadStreets);
  const visit = useV2((s) => s.visit);
  const goHome = useV2((s) => s.goHome);
  const [q, setQ] = useState("");
  const [streets, setStreets] = useState<StreetListing[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void loadStreets(q.trim()).then((list) => alive && setStreets(list));
    }, q ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, loadStreets]);

  async function onVisit(street: StreetListing) {
    if (busy) return;
    setBusy(street.id);
    setError(null);
    const result = await visit(street.id);
    setBusy(null);
    if (!result.ok) {
      sound.deny();
      setError(result.message);
      return;
    }
    sound.tap();
    navigate("/");
  }

  return (
    <Sheet title="🗺️ Bummeln" onClose={() => navigate("/")}>
      <p className="subtle">Schau dir an, was andere Straßen in ihren Schaufenstern haben – kaufen kannst du überall.</p>
      {visiting && (
        <button
          type="button"
          className="btn btn-primary btn-wide"
          onClick={() => {
            sound.tap();
            goHome();
            navigate("/");
          }}
        >
          🏠 Zurück nach Hause ({home.name})
        </button>
      )}
      <label className="field">
        <span>Straße oder Ort</span>
        <input type="search" value={q} placeholder="z. B. Ulm" onChange={(e) => setQ(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      {streets === null ? (
        <p className="subtle">Lade Straßen …</p>
      ) : streets.length === 0 ? (
        <p className="subtle">Keine Straße gefunden.</p>
      ) : (
        <ul className="shop-list">
          {streets.map((s) => {
            const mine = s.id === home.id;
            const here = s.id === (visiting?.id ?? home.id);
            return (
              <li key={s.id}>
                <button type="button" className={`shop-row${mine ? " mine" : ""}`} disabled={busy !== null} onClick={() => void onVisit(s)}>
                  <span className="shop-emoji">{mine ? "🏠" : "🛣️"}</span>
                  <span className="shop-text">
                    <b>{s.name}</b>
                    <small>
                      {s.city} · {s.members} Spieler · {s.shops} {s.shops === 1 ? "Laden" : "Läden"}
                      {here ? " · du bist hier" : ""}
                    </small>
                  </span>
                  <span className="chev">{busy === s.id ? "…" : "›"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
