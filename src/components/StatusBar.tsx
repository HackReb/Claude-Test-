import { useState } from "react";
import { sound } from "../audio/sound";
import { capacityOf } from "../config/economy";
import { formatCoins, formatRate } from "../format";
import { occupancyOf, streetNeeds, targetOccupancy, useOf } from "../game/life";
import { petUpkeepPerHour } from "../game/pets";
import { playerIncomePerHour, playerUpkeepPerHour } from "../game/rent";
import type { Building, Plot } from "../model/types";
import { useAllStreets } from "../store/useStreetContext";
import { useGameStore } from "../store/gameStore";

export type StreetTab = "residents" | "security" | "shop" | "more";

/**
 * Alles Wichtige auf einen Blick: Kasse + Einsammeln, Bewohner, Gewinn pro Stunde, Sauberkeit.
 * Ein Tipp auf eine Kachel öffnet den passenden Reiter darunter.
 */
export function StatusBar({ onOpen }: { onOpen: (tab: StreetTab) => void }) {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;
  const collect = useGameStore((s) => s.collect);
  const streets = useAllStreets();
  const [toast, setToast] = useState<string | null>(null);

  const pending = Math.floor(player.pendingRent);
  const income = playerIncomePerHour(streets, player.id);
  const upkeep = playerUpkeepPerHour(streets, player.id) + petUpkeepPerHour(player);
  const net = income - upkeep;

  const homes = street.plots.filter(
    (p): p is Plot & { building: Building } => p.purchasedAt !== undefined && !!p.building && useOf(p.building) === "residential" && !p.ownerId,
  );
  const places = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential"), 0);
  const people = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential") * occupancyOf(street, p), 0);
  const target = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential") * targetOccupancy(street, p), 0);
  const trend = target > people + 0.5 ? "↗" : target < people - 0.5 ? "↘" : "";
  const clean = streetNeeds(street).find((n) => n.id === "clean")!;
  const missing = streetNeeds(street).filter((n) => !n.met).length;

  async function onCollect() {
    const amount = await collect();
    if (amount > 0) {
      sound.coins(amount);
      setToast(`+${formatCoins(amount)} eingesammelt!`);
      setTimeout(() => setToast(null), 1800);
    }
  }

  return (
    <section className="statusbar card" aria-label="Überblick">
      <div className="status-cash">
        <span className="status-label">Miete in der Kasse</span>
        <strong className="status-amount">🪙 {formatCoins(pending)}</strong>
        <button type="button" className="btn btn-primary" disabled={pending < 1} onClick={() => void onCollect()}>
          Einsammeln
        </button>
        {toast && (
          <span className="rentbar-toast" role="status">
            {toast}
          </span>
        )}
      </div>
      <div className="status-chips">
        <button type="button" className={`status-chip${trend === "↘" ? " bad" : ""}`} onClick={() => onOpen("residents")}>
          <span>👥 Bewohner</span>
          <strong>
            {places > 0 ? `${Math.round(people)}/${places}` : "–"} {trend}
          </strong>
        </button>
        <button type="button" className={`status-chip${net < 0 ? " bad" : " good"}`} onClick={() => onOpen("residents")}>
          <span>{net < 0 ? "📉 Verlust" : "📈 Gewinn"}</span>
          <strong>
            {net < 0 ? "−" : "+"}
            {formatRate(Math.abs(net))}
            <small>/h</small>
          </strong>
        </button>
        <button type="button" className={`status-chip${clean.met ? "" : " bad"}`} onClick={() => onOpen("residents")}>
          <span>{clean.met ? "🧹 Sauber" : "🤢 Dreckig"}</span>
          <strong>{missing === 0 ? "alles ok" : `${missing} offen`}</strong>
        </button>
      </div>
      <p className="status-detail">
        +{formatRate(income)} Miete · −{formatRate(upkeep)} Kosten pro Stunde
      </p>
    </section>
  );
}
