import { useState } from "react";
import { formatCoins, formatRate } from "../format";
import { sound } from "../audio/sound";
import { playerIncomePerHour, playerUpkeepPerHour, streetIncomePerHour } from "../game/rent";
import { useAllStreets } from "../store/useStreetContext";
import { useGameStore } from "../store/gameStore";

/** Kasse (angesammelte Miete) + Einsammeln, darunter Einnahmen und laufende Kosten pro Stunde. */
export function RentBar() {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;
  const collect = useGameStore((s) => s.collect);
  const [lastCollected, setLastCollected] = useState<number | null>(null);

  const pending = Math.floor(player.pendingRent);
  const streets = useAllStreets();
  const income = playerIncomePerHour(streets, player.id);
  const upkeep = playerUpkeepPerHour(streets, player.id);
  const fromNeighbors = income - streetIncomePerHour(street, player.id);
  const net = income - upkeep;

  async function onCollect() {
    const amount = await collect();
    if (amount > 0) sound.coins(amount);
    setLastCollected(amount);
  }

  return (
    <section className="rentbar card" aria-live="polite">
      <div className="rentbar-info">
        <span className="rentbar-label">Miete in der Kasse</span>
        <strong className="rentbar-amount">🪙 {formatCoins(pending)}</strong>
        <span className="rentbar-rate">
          +{formatRate(income)}/Std. Miete{fromNeighbors > 0.05 && ` (${formatRate(fromNeighbors)} aus Nachbarstraßen)`} · −{formatRate(upkeep)}
          /Std. Kosten
        </span>
        <span className={`rentbar-net${net < 0 ? " negative" : ""}`}>
          {net >= 0 ? `Gewinn 🪙 ${formatRate(net)} pro Stunde` : `⚠️ Verlust 🪙 ${formatRate(-net)} pro Stunde – deine Häuser leeren sich!`}
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
