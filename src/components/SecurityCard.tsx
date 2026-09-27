import { sound } from "../audio/sound";
import { securityOf } from "../config/badboys";
import { formatCoins, formatRate } from "../format";
import { nextSecurity } from "../game/mischief";
import type { Street } from "../model/types";
import { useGameStore } from "../store/gameStore";

/** Wachschutz der eigenen Straße: fängt einen Teil der Bad Boys ab, die Nachbarn schicken. */
export function SecurityCard({ street }: { street: Street }) {
  const coins = useGameStore((s) => s.player!.coins);
  const buy = useGameStore((s) => s.buySecurity);
  const current = securityOf(street.security);
  const next = nextSecurity(street);

  return (
    <section className="card security" aria-label="Wachschutz">
      <h2>
        {current ? `${current.emoji} ${current.name}` : "🛡️ Kein Wachschutz"}
        {current && <small> · fängt {Math.round(current.blockChance * 100)} % der Bad Boys ab</small>}
      </h2>
      {next && (
        <>
          <p className="subtle">
            {next.emoji} {next.name}: fängt {Math.round(next.blockChance * 100)} % ab – und wer erwischt wird, verrät, wer ihn geschickt hat.
            Kosten 🪙 {formatRate(next.upkeepPerHour)}/Std.
          </p>
          <button
            type="button"
            className="btn"
            disabled={coins < next.price}
            onClick={async () => {
              if ((await buy()).ok) sound.upgrade();
              else sound.deny();
            }}
          >
            {current ? "Verstärken" : "Einstellen"} für 🪙 {formatCoins(next.price)}
          </button>
        </>
      )}
    </section>
  );
}
