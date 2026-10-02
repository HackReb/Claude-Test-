import { useState, type FormEvent } from "react";
import { useV2 } from "../store";

type Mode = "login" | "register";

/** Anmelden oder Konto anlegen – dieselben Konten wie in Babo 1. */
export function WelcomeScreen() {
  const login = useV2((s) => s.login);
  const register = useV2((s) => s.register);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = mode === "login" ? await login(name, password) : await register(name, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <img src="../icon.svg" alt="" width={96} height={96} />
        <h1>Babo 2</h1>
        <p>Eröffne Läden in der Mall deiner echten Straße, erfinde eigene Waren – und schau zu, wer sie trägt.</p>
      </div>
      <form className="card form" onSubmit={onSubmit}>
        <div className="segmented" role="radiogroup" aria-label="Konto">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "selected" : ""} onClick={() => setMode(m)}>
              {m === "login" ? "Anmelden" : "Neues Konto"}
            </button>
          ))}
        </div>
        {mode === "login" && <p className="subtle">Dein Konto aus Babo 1 geht hier auch.</p>}
        <label className="field">
          <span>Name</span>
          <input value={name} autoComplete="username" maxLength={20} placeholder="z. B. Papa Matthias" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            type="password"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="mindestens 6 Zeichen"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 3 || password.length < 6}>
          {busy ? "Moment …" : mode === "login" ? "Anmelden" : "Konto anlegen"}
        </button>
      </form>
    </div>
  );
}
