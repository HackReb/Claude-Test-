import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Server-Konto: Anmelde-Code fürs Weiterspielen auf einem anderen Gerät, Abmelden, Hinweise bei Problemen. */
export function AccountCard() {
  const account = useGameStore((s) => s.account);
  const signOut = useGameStore((s) => s.signOut);
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "offline">("idle");
  if (!account) return null;

  async function onSignOut() {
    setState("busy");
    if (await signOut()) navigate(routes.start, { replace: true, state: { login: true } });
    else setState("offline");
  }

  async function onCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setShown(true); // Kopieren gesperrt: dann eben abschreiben.
    }
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
  if (account.status === "signed-out") {
    return (
      <div className="card account-card warn">
        <strong>Dieses Gerät ist abgemeldet</strong>
        <p className="subtle">Dein Code wurde auf einem anderen Gerät benutzt. Dort geht dein Spiel weiter – hier wird nichts mehr gespeichert.</p>
        {account.recoveryCode && <code className="recovery-code">{account.recoveryCode}</code>}
        <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void onSignOut()}>
          🔑 Mit Code anmelden
        </button>
      </div>
    );
  }
  if (account.status === "pending") {
    return (
      <div className="card account-card">
        <strong>Noch nicht online</strong>
        <p className="subtle">
          Der Server war nicht erreichbar. Beim nächsten Start meldet sich das Spiel von selbst an – dann bekommst du hier deinen Anmelde-Code.
        </p>
      </div>
    );
  }

  const code = account.recoveryCode;
  return (
    <div className="card account-card">
      <strong>🔑 Dein Anmelde-Code</strong>
      {!code ? (
        <p className="subtle">Auf diesem Gerät ist kein Code gespeichert.</p>
      ) : (
        <>
          {shown ? (
            <code className="recovery-code">{code}</code>
          ) : (
            <button type="button" className="btn" onClick={() => setShown(true)}>
              Code anzeigen
            </button>
          )}
          <p className="subtle">
            Damit spielst du auf einem anderen Handy weiter: Spiel öffnen → „Mit Code anmelden“. Schreib ihn dir auf und gib ihn nicht weiter –
            wer den Code kennt, kann mit deiner Straße spielen.
          </p>
          <button type="button" className="btn btn-link" onClick={() => void onCopy(code)}>
            {copied ? "✅ Kopiert!" : "📋 Code kopieren"}
          </button>
        </>
      )}

      {code &&
        (confirm ? (
          <div className="confirm">
            <p>
              Abmelden? Deine Straße bleibt gespeichert – zurück kommst du nur mit dem Code <strong>{code}</strong>.
            </p>
            {state === "offline" && <p className="error">Der Server ist gerade nicht erreichbar. Es wurde nichts gelöscht – versuch es gleich nochmal.</p>}
            <div className="actions">
              <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void onSignOut()}>
                {state === "busy" ? "Speichere …" : "Code notiert – abmelden"}
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
        ))}
    </div>
  );
}
