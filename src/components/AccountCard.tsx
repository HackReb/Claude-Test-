import { useState } from "react";
import { useGameStore } from "../store/gameStore";

/** Server-Konto: Code fürs Weiterspielen auf einem anderen Gerät, Hinweise bei Problemen. */
export function AccountCard() {
  const account = useGameStore((s) => s.account);
  const [shown, setShown] = useState(false);
  if (!account) return null;

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
      <strong>🔑 Auf anderem Gerät weiterspielen</strong>
      {shown && account.recoveryCode ? (
        <>
          <code className="recovery-code">{account.recoveryCode}</code>
          <p className="subtle">
            Schreib dir den Code auf. Auf dem neuen Gerät: Spiel öffnen → „Ich habe schon einen Code“. Wer den Code kennt, kann mit deiner
            Straße spielen – nicht weitergeben!
          </p>
        </>
      ) : (
        <button type="button" className="btn btn-link" onClick={() => setShown(true)} disabled={!account.recoveryCode}>
          {account.recoveryCode ? "Code anzeigen" : "Kein Code auf diesem Gerät"}
        </button>
      )}
    </div>
  );
}
