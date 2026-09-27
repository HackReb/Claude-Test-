import { capacityOf, upkeepOf } from "../config/economy";
import { formatRate } from "../format";
import { useOf } from "../game/life";
import { buildingIncomePerHour } from "../game/rent";
import type { Building, PlotSize } from "../model/types";

/** Was ein Gebäude bringen kann: Plätze, Einnahmen wenn voll, laufende Kosten. */
export function BuildingEconomy({ size, building }: { size: PlotSize; building: Building }) {
  const places = capacityOf(size, building.level);
  const home = useOf(building) === "residential";
  return (
    <p className="subtle building-economy">
      {home ? `👥 bis ${places} Bewohner` : `🛒 ${places} Kundenplätze`} · bis 🪙 {formatRate(buildingIncomePerHour(size, building))}/Std., wenn
      voll · Kosten 🪙 {formatRate(upkeepOf(size, building.level))}/Std.
    </p>
  );
}
