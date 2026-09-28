import { capacityOf } from "../config/economy";
import { occupancyOf, streetNeeds, targetOccupancy, useOf } from "../game/life";
import type { Building, Plot, Street } from "../model/types";

type Built = Plot & { building: Building };

/** Wohlfühl-Liste der eigenen Straße: Was brauchen die Bewohner, wie voll sind die Häuser, ziehen Leute ein oder aus? */
export function WellbeingCard({ street, playerId }: { street: Street; playerId: string }) {
  const homes = street.plots.filter(
    (p): p is Built => p.purchasedAt !== undefined && !!p.building && useOf(p.building) === "residential" && (p.ownerId ?? street.ownerId) === playerId,
  );
  const places = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential"), 0);
  const people = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential") * occupancyOf(street, p), 0);
  const target = homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential") * targetOccupancy(street, p), 0);
  const needs = streetNeeds(street);
  const trend = target > people + 0.5 ? "up" : target < people - 0.5 ? "down" : "steady";

  return (
    <section className={`card wellbeing${trend === "down" ? " warn" : ""}`} aria-label="Wohlfühl-Liste">
      <div className="wellbeing-head">
        <strong>{homes.length === 0 ? "👥 Noch keine Bewohner" : `👥 ${Math.round(people)} von ${places} Bewohnern`}</strong>
        <span className={`wellbeing-trend ${trend}`}>
          {homes.length === 0
            ? "Bau ein Wohnhaus – Bewohner zahlen Miete."
            : trend === "up"
              ? "↗ Leute ziehen ein"
              : trend === "down"
                ? "↘ Leute ziehen aus!"
                : people >= places - 0.5
                  ? "Alles voll 🎉"
                  : "Stabil"}
        </span>
      </div>
      {homes.length > 0 && places > 0 && (
        <div className="meter" role="img" aria-label={`${Math.round((people / places) * 100)} % belegt`}>
          <span style={{ width: `${Math.min(100, (people / places) * 100)}%` }} />
        </div>
      )}
      <ul className="needs">
        {needs.map((need) => (
          <li key={need.id} className={need.met ? "met" : "missing"}>
            <span aria-hidden>{need.met ? "✅" : "❌"}</span> {need.label}
            {!need.met && <small> – Häuser höchstens {Math.round(need.factor * 100)} % voll</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
