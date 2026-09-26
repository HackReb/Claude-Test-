import { useState } from "react";
import { formatCoins, formatRate } from "../format";
import { sound } from "../audio/sound";
import { rentModifiers, streetStats } from "../game/life";
import { streetRentPerMinute } from "../game/rent";
import { useGameStore } from "../store/gameStore";

/** Angesammelte Miete + Einsammeln-Button. */
export function RentBar() {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;
  const collect = useGameStore((s) => s.collect);
  const [lastCollected, setLastCollected] = useState<number | null>(null);

  const pending = Math.floor(player.pendingRent);
  const rate = streetRentPerMinute(street);

  const stats = streetStats(street);
  const penalty = Math.round((1 - rentModifiers(street).cleanliness) * 100);

  async function onCollect() {
    const amount = await collect();
    if (amount > 0) sound.coins(amount);
    setLastCollected(amount);
  }

  return (
    <section className="rentbar card" aria-live="polite">
      <div className="rentbar-info">
        <span className="rentbar-label">Miete bereit</span>
        <strong className="rentbar-amount">🪙 {formatCoins(pending)}</strong>
        <span className="rentbar-rate">+{formatRate(rate)} pro Minute</span>
        <span className={`rentbar-clean${penalty > 0 ? " dirty" : ""}`}>
          {penalty === 0 ? "😊 Straße sauber" : `${stats.litter >= 8 ? "🤢" : "😒"} ${stats.litter}× Dreck: −${penalty} % Miete`}
        </span>
      </div>
      <button type="button" className="btn btn-primary" disabled={pending < 1} onClick={onCollect}>
        Einsammeln
      </button>
      {lastCollected !== null && lastCollected > 0 && pending < 1 && (
        <span className="rentbar-toast">+{formatCoins(lastCollected)} eingesammelt!</span>
      )}
    </section>
  );
}
