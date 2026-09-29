import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { AccountStreets, LoginForm } from "./AccountForms";

/** Konto: angemeldet mit Name + Passwort, bis zu drei Straßen, Abmelden – und Hinweise bei älteren Spielständen. */
export function AccountCard() {
  const account = useGameStore((s) => s.account);
  const signOut = useGameStore((s) => s.signOut);
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "offline">("idle");
  if (!account) return null;

  async function onSignOut() {
    setState("busy");
    if (!(await signOut())) setState("offline");
  }

  if (account.status === "street-taken") {
    return (
      <div className="card account-card warn">
        <strong>Nur auf diesem Gerät</strong>
        <p className="subtle">
          Deine Straße gehört online schon {account.takenBy ?? "jemand anderem"} – wer zuerst kommt, dem gehört sie. Dein Spielstand bleibt hier
          auf dem Gerät. Wenn du mit allen spielen willst: Spielstand zurücksetzen und eine andere Straße claimen.
        </p>
      </div>
    );
  }
  if (account.status === "signed-out" || account.status === "logged-out") {
    return (
      <div className="card account-card warn">
        <strong>Dieses Gerät ist abgemeldet</strong>
        <p className="subtle">Melde dich mit Name und Passwort an – dann geht es mit deinen Straßen weiter.</p>
        <LoginForm />
      </div>
    );
  }
  if (account.status === "legacy") {
    return (
      <div className="card account-card">
        <strong>🔐 Konto einrichten</strong>
        <p className="subtle">
          Sichere deine Straße mit Name und Passwort. Dann kannst du dich auf jedem Handy anmelden und bis zu drei Straßen haben.
        </p>
        {account.recoveryCode && (
          <p className="subtle">
            Dein bisheriger Code: <code className="recovery-code">{account.recoveryCode}</code>
          </p>
        )}
        <LoginForm initial="register" legacy />
      </div>
    );
  }
  if (account.status === "pending") {
    return (
      <div className="card account-card">
        <strong>Noch nicht online</strong>
        <p className="subtle">Der Server war nicht erreichbar. Beim nächsten Start meldet sich das Spiel von selbst an.</p>
      </div>
    );
  }

  return (
    <div className="card account-card">
      <strong>👤 {account.name}</strong>
      <AccountStreets />
      {confirm ? (
        <div className="confirm">
          <p>Abmelden? Deine Straßen bleiben gespeichert – zurück kommst du mit Name und Passwort.</p>
          {state === "offline" && <p className="error">Der Server ist gerade nicht erreichbar. Es wurde nichts gelöscht – versuch es gleich nochmal.</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void onSignOut()}>
              {state === "busy" ? "Speichere …" : "Abmelden"}
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setConfirm(true)}>
          🚪 Abmelden
        </button>
      )}
    </div>
  );
}
