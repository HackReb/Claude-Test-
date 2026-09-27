import { useState } from "react";
import { sound } from "../audio/sound";
import { BAD_BOYS, MISCHIEF } from "../config/badboys";
import { formatCoins } from "../format";
import { intoStreet } from "../game/names";
import { useGameStore } from "../store/gameStore";

const EFFECT: Record<string, string> = {
  trash: "Müll",
  poop: "Hundehaufen",
  graffiti: "Graffiti an ein Haus",
  smash: "Fenster kaputt",
};

/** Bad Boys gegen Geld in eine Nachbarstraße schicken. */
export function BadBoysCard({ streetId, streetName }: { streetId: string; streetName: string }) {
  const coins = useGameStore((s) => s.player!.coins);
  const send = useGameStore((s) => s.sendBadBoy);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSend(id: string) {
    setBusy(id);
    try {
      const sent = await send(streetId, id);
      if (sent.ok) {
        if (sent.blocked) sound.deny();
        else sound.horn("knatter");
        setResult({ ok: !sent.blocked, text: sent.text });
      } else {
        sound.deny();
        setResult({ ok: false, text: sent.message });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card badboys" aria-label="Bad Boys">
      <h2>😈 Ärger bestellen</h2>
      <p className="subtle">
        Schick jemanden {intoStreet(streetName)}: Dreck, Graffiti und kaputte Fenster vergraulen dort die Bewohner – und drücken die Einnahmen.
        Aber Vorsicht: Mit Wachschutz fliegt auf, wer es war.
      </p>
      <ul className="badboy-list">
        {BAD_BOYS.map((bb) => (
          <li key={bb.id}>
            <span className="badboy-emoji" aria-hidden>
              {bb.emoji}
            </span>
            <span className="badboy-info">
              <strong>{bb.name}</strong>
              <small>{bb.blurb}</small>
              <small className="badboy-effect">
                → {bb.kind === "trash" || bb.kind === "poop" ? `${bb.amount}× ${EFFECT[bb.kind]}` : EFFECT[bb.kind]}
                {bb.kind === "graffiti" && ` (wie ${MISCHIEF.graffitiAsLitter}× Dreck)`}
                {bb.kind === "smash" && " (Haus nur noch halb voll)"}
              </small>
            </span>
            <button type="button" className="btn btn-primary" disabled={coins < bb.price || busy !== null} onClick={() => void onSend(bb.id)}>
              🪙 {formatCoins(bb.price)}
            </button>
          </li>
        ))}
      </ul>
      {result && (
        <p className={result.ok ? "badboy-result" : "error"} role="status">
          {result.text}
        </p>
      )}
    </section>
  );
}
