import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ECONOMY } from "../config/economy";
import { NAME_MAX_LENGTH, validateClaim, type ClaimInput } from "../game/claimStreet";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

const FIELDS: { key: keyof ClaimInput; label: string; placeholder: string; autoComplete: string }[] = [
  { key: "playerName", label: "Dein Name", placeholder: "z. B. Babo Kalle", autoComplete: "nickname" },
  { key: "streetName", label: "Deine Straße", placeholder: "z. B. Bahnhofstraße", autoComplete: "address-line1" },
  { key: "city", label: "Ort", placeholder: "z. B. Tuttlingen", autoComplete: "address-level2" },
];

export function ClaimScreen() {
  const claim = useGameStore((s) => s.claim);
  const navigate = useNavigate();
  const [input, setInput] = useState<ClaimInput>({ playerName: "", streetName: "", city: "" });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateClaim(input);
  const valid = Object.keys(errors).length === 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      await claim(input);
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
        {FIELDS.map(({ key, label, placeholder, autoComplete }) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              value={input[key]}
              placeholder={placeholder}
              autoComplete={autoComplete}
              maxLength={NAME_MAX_LENGTH}
              aria-invalid={touched && !!errors[key]}
              onChange={(e) => setInput({ ...input, [key]: e.target.value })}
            />
            {touched && errors[key] && <small className="error">{errors[key]}</small>}
          </label>
        ))}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {input.streetName.trim() ? `${input.streetName.trim()} claimen` : "Straße claimen"}
        </button>
        <p className="hint">
          Startbonus: 🪙 {ECONOMY.startCoins.toLocaleString("de-DE")} Münzen + ein geschenktes{" "}
          {ECONOMY.giftPlotSize}-Grundstück.
        </p>
      </form>
    </div>
  );
}
