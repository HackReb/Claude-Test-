import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { StreetSearch } from "../components/StreetSearch";
import { ECONOMY } from "../config/economy";
import { NAME_MAX_LENGTH, validateClaim } from "../game/claimStreet";
import { formatPlace } from "../geo/streetSearch";
import type { StreetLocation } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Straße: aus der Kartensuche gewählt, manuell eingetippt (Kartendienst weg) oder noch offen. */
type StreetChoice = { mode: "search"; selected: StreetLocation | null } | { mode: "manual"; name: string; city: string };

export function ClaimScreen() {
  const claim = useGameStore((s) => s.claim);
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [choice, setChoice] = useState<StreetChoice>({ mode: "search", selected: null });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const street: StreetLocation =
    choice.mode === "manual" ? { name: choice.name, city: choice.city } : (choice.selected ?? { name: "", city: "" });
  const errors = validateClaim({ playerName, street });
  const valid = Object.keys(errors).length === 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      await claim({ playerName, street });
      navigate(routes.street, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="claim">
      <div className="claim-hero">
        <img src="./icon.svg" alt="" width={96} height={96} />
        <h1>Claim deine Straße!</h1>
        <p>Bau verrückte Häuser in deiner echten Straße, kassier Miete und zeig's deinen Freunden.</p>
      </div>

      <form className="card claim-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Dein Name</span>
          <input
            value={playerName}
            placeholder="z. B. Babo Kalle"
            autoComplete="nickname"
            maxLength={NAME_MAX_LENGTH}
            aria-invalid={touched && !!errors.playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          {touched && errors.playerName && <small className="error">{errors.playerName}</small>}
        </label>

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

        {choice.mode === "search" && !choice.selected && (
          <>
            <StreetSearch
              onSelect={(selected) => setChoice({ mode: "search", selected })}
              onManual={() => setChoice({ mode: "manual", name: "", city: "" })}
            />
            {touched && errors.streetName && <small className="error">Wähl deine Straße aus den Vorschlägen.</small>}
          </>
        )}

        {choice.mode === "manual" && (
          <>
            <label className="field">
              <span>Deine Straße</span>
              <input
                value={choice.name}
                placeholder="z. B. Bahnhofstraße"
                autoComplete="address-line1"
                maxLength={NAME_MAX_LENGTH}
                aria-invalid={touched && !!errors.streetName}
                onChange={(e) => setChoice({ ...choice, name: e.target.value })}
              />
              {touched && errors.streetName && <small className="error">{errors.streetName}</small>}
            </label>
            <label className="field">
              <span>Ort</span>
              <input
                value={choice.city}
                placeholder="z. B. Tuttlingen"
                autoComplete="address-level2"
                maxLength={NAME_MAX_LENGTH}
                aria-invalid={touched && !!errors.city}
                onChange={(e) => setChoice({ ...choice, city: e.target.value })}
              />
              {touched && errors.city && <small className="error">{errors.city}</small>}
            </label>
            <p className="hint left">
              Deine Straße wird als <strong>ungeprüft</strong> gespeichert. Du kannst sie später auf der Karte bestätigen.{" "}
              <button type="button" className="btn-inline" onClick={() => setChoice({ mode: "search", selected: null })}>
                Doch suchen
              </button>
            </p>
          </>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {street.name.trim() ? `${street.name.trim()} claimen` : "Straße claimen"}
        </button>
        <p className="hint">
          Startbonus: 🪙 {ECONOMY.startCoins.toLocaleString("de-DE")} Münzen + ein geschenktes{" "}
          {ECONOMY.giftPlotSize}-Grundstück mit Kiosk.
        </p>
      </form>
    </div>
  );
}
