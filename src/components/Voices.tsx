import type { Voice } from "../game/life";

/** „Stimmen aus der Straße“ – Wünsche, Beschwerden und Lob der Bewohner. */
export function Voices({ voices, highlight }: { voices: Voice[]; highlight?: string | null }) {
  if (voices.length === 0) return null;
  return (
    <section className="voices" aria-label="Stimmen aus der Straße" id="voices">
      <h2>Stimmen aus der Straße</h2>
      <ul>
        {voices.map((v) => (
          <li key={v.id} className={`voice voice-${v.tone}${highlight === v.id ? " highlight" : ""}`}>
            <span className="voice-emoji" aria-hidden>
              {v.emoji}
            </span>
            <div>
              <small>{v.speaker}</small>
              <strong>„{v.quote}“</strong>
              <span>{v.effect}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
