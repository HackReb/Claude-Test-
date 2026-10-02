import { useState } from "react";
import { StreetSearch } from "../../components/StreetSearch";
import { formatPlace } from "../../geo/streetSearch";
import type { StreetLocation } from "../../model/types";
import { STREET_MAX_MEMBERS } from "../config/growth";
import { useV2 } from "../store";

type Choice = { mode: "search"; selected: StreetLocation | null } | { mode: "manual"; name: string; city: string };

/** Genau eine Straße pro Konto: auf der Karte suchen, dann beitreten oder gründen. */
export function ChooseStreetScreen() {
  const account = useV2((s) => s.account);
  const join = useV2((s) => s.join);
  const logout = useV2((s) => s.logout);
  const [choice, setChoice] = useState<Choice>({ mode: "search", selected: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location: StreetLocation | null =
    choice.mode === "manual" ? (choice.name.trim() && choice.city.trim() ? { name: choice.name.trim(), city: choice.city.trim() } : null) : choice.selected;

  async function onJoin() {
    if (!location || busy) return;
    setBusy(true);
    setError(null);
    const result = await join({ name: location.name, city: location.city, osm: location.osm });
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <h1>Hallo {account?.name}!</h1>
        <p>
          Wähl deine Straße. Dort hast du einen festen Platz in der Mall. Bis zu {STREET_MAX_MEMBERS} Spieler teilen sich eine Straße – wer sie zuerst
          wählt, gründet sie.
        </p>
      </div>
      <div className="card form">
        {choice.mode === "search" && !choice.selected && (
          <StreetSearch onSelect={(selected) => setChoice({ mode: "search", selected })} onManual={() => setChoice({ mode: "manual", name: "", city: "" })} />
        )}
        {choice.mode === "search" && choice.selected && (
          <div className="field">
            <span>Deine Straße</span>
            <div className="chosen-street">
              <div>
                <strong>{choice.selected.name}</strong>
                <span>{formatPlace(choice.selected)}</span>
              </div>
              <button type="button" className="btn btn-link" onClick={() => setChoice({ mode: "search", selected: null })}>
                Ändern
              </button>
            </div>
          </div>
        )}
        {choice.mode === "manual" && (
          <>
            <label className="field">
              <span>Straße</span>
              <input value={choice.name} autoComplete="address-line1" placeholder="z. B. Bahnhofstraße" onChange={(e) => setChoice({ ...choice, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Ort</span>
              <input value={choice.city} autoComplete="address-level2" placeholder="z. B. Tuttlingen" onChange={(e) => setChoice({ ...choice, city: e.target.value })} />
            </label>
            <button type="button" className="btn btn-link" onClick={() => setChoice({ mode: "search", selected: null })}>
              Doch auf der Karte suchen
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={!location || busy} onClick={() => void onJoin()}>
          {busy ? "Moment …" : location ? `In die ${location.name} ziehen` : "Straße wählen"}
        </button>
      </div>
      <button type="button" className="btn btn-link" onClick={() => void logout()}>
        Abmelden
      </button>
    </div>
  );
}
