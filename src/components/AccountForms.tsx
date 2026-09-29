import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

type Mode = "login" | "register";

/** Anmelden mit Name + Passwort oder ein neues Konto anlegen. */
export function LoginForm({ initial = "login", legacy = false }: { initial?: Mode; legacy?: boolean }) {
  const login = useGameStore((s) => s.login);
  const createAccount = useGameStore((s) => s.createAccount);
  const [mode, setMode] = useState<Mode>(initial);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = mode === "login" ? await login(name, password) : await createAccount(name, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <form className="card claim-form account-form" onSubmit={onSubmit}>
      <div className="segmented" role="radiogroup" aria-label="Konto">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? "selected" : ""}
            onClick={() => setMode(m)}
          >
            {m === "login" ? "Anmelden" : "Neues Konto"}
          </button>
        ))}
      </div>
      {mode === "register" && (
        <p className="subtle">
          {legacy
            ? "Deine Straße kommt mit ins Konto. Danach meldest du dich überall mit Name und Passwort an."
            : "Mit einem Konto kannst du bis zu drei Straßen claimen – auch in verschiedenen Orten."}
        </p>
      )}
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          autoComplete="username"
          maxLength={20}
          placeholder="z. B. Papa Matthias"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "register" ? "mindestens 6 Zeichen" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || name.trim().length < 3 || password.length < (mode === "register" ? 6 : 1)}
      >
        {busy ? "Moment …" : mode === "login" ? "Anmelden" : "Konto anlegen"}
      </button>
    </form>
  );
}

/**
 * Die Straßen des Kontos: wechseln, neue claimen, ältere per BABO-Code anhängen.
 * Nach dem Wechsel lädt das Spiel neu und landet von selbst in der gewählten Straße.
 */
export function AccountStreets() {
  const account = useGameStore((s) => s.account);
  const selectStreet = useGameStore((s) => s.selectStreet);
  const startNewStreet = useGameStore((s) => s.startNewStreet);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!account?.streets) return null;
  const { streets, activePlayerId } = account;
  const max = account.maxStreets ?? 3;

  async function open(playerId: string) {
    setBusy(playerId);
    setError(null);
    // Gleich zur Straße – das Spiel lädt kurz neu und zeigt dann die gewählte.
    navigate(routes.street);
    if (!(await selectStreet(playerId))) {
      setBusy(null);
      setError("Der Server ist gerade nicht erreichbar. Versuch es gleich nochmal.");
    }
  }

  async function startNew() {
    setBusy("new");
    setError(null);
    if (!(await startNewStreet())) {
      setBusy(null);
      setError("Der Server ist gerade nicht erreichbar. Versuch es gleich nochmal.");
    }
  }

  return (
    <div className="account-streets">
      <ul className="street-choice">
        {streets.map((s) => (
          <li key={s.playerId}>
            <button
              type="button"
              className={`card street-choice-item${s.playerId === activePlayerId ? " active" : ""}`}
              disabled={!!busy || s.playerId === activePlayerId}
              onClick={() => void open(s.playerId)}
            >
              <span aria-hidden>🏠</span>
              <span>
                <strong>{s.streetName}</strong>
                <small>{s.city}</small>
              </span>
              <em>{s.playerId === activePlayerId ? "gerade hier" : busy === s.playerId ? "lädt …" : "Spielen ▶"}</em>
            </button>
          </li>
        ))}
      </ul>
      <p className="subtle">
        {streets.length} von {max} Straßen.
      </p>
      {activePlayerId && streets.length < max && (
        <button type="button" className="btn" disabled={!!busy} onClick={() => void startNew()}>
          ＋ Weitere Straße claimen
        </button>
      )}
      {error && <p className="error">{error}</p>}
      <AttachCodeForm />
    </div>
  );
}

/** Ältere Straße (von vor den Konten) mit ihrem BABO-Code ins Konto holen. */
export function AttachCodeForm() {
  const attach = useGameStore((s) => s.attachCode);
  const account = useGameStore((s) => s.account);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if ((account?.streets?.length ?? 0) >= (account?.maxStreets ?? 3)) return null;

  if (!open) {
    return (
      <button type="button" className="btn btn-link" onClick={() => setOpen(true)}>
        🔑 Alte Straße mit BABO-Code übernehmen
      </button>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await attach(code);
    setMessage(result.ok ? { ok: true, text: "Übernommen! Die Straße steht jetzt in deiner Liste." } : { ok: false, text: result.message });
    if (result.ok) setCode("");
  }

  return (
    <form className="attach-form" onSubmit={onSubmit}>
      <label className="field">
        <span>BABO-Code der alten Straße</span>
        <input
          value={code}
          placeholder="BABO-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </label>
      {message && <p className={message.ok ? "subtle" : "error"}>{message.text}</p>}
      <button type="submit" className="btn" disabled={code.replace(/[^A-Z0-9]/g, "").length < 12}>
        Übernehmen
      </button>
    </form>
  );
}
