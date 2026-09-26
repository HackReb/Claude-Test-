import { useState } from "react";
import { formatCoins, formatRate } from "../format";
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

  async function onCollect() {
    setLastCollected(await collect());
  }

  return (
    <section className="rentbar card" aria-live="polite">
      <div className="rentbar-info">
        <span className="rentbar-label">Miete bereit</span>
        <strong className="rentbar-amount">🪙 {formatCoins(pending)}</strong>
        <span className="rentbar-rate">+{formatRate(rate)} pro Minute</span>
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
