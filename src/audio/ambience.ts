import type { AmbienceLevels } from "./sound";
import { layoutStreet } from "../components/street/layout";
import { useOf } from "../game/life";
import type { Street } from "../model/types";

/**
 * Straßengeräusche passend zum sichtbaren Ausschnitt (0–1 der Straßenbreite):
 * Wohnhäuser → Kinder, Läden → Stimmengewirr und Ladenglocke, Palmen/Grün → Vögel,
 * Hundehaufen → Fliegen, Verkehr immer ein bisschen.
 */
export function ambienceFor(street: Street, from: number, to: number): AmbienceLevels {
  const { lots, width } = layoutStreet(street.plots);
  const visible = lots.filter((l) => (l.x + l.width) / width > from && l.x / width < to);
  const owned = visible.filter((l) => l.plot.purchasedAt !== undefined);
  const homes = owned.filter((l) => l.plot.building && useOf(l.plot.building) === "residential").length;
  const shops = owned.filter((l) => l.plot.building && useOf(l.plot.building) === "commercial").length;
  const playgrounds = owned.filter((l) => l.plot.amenity === "playground").length;
  const green =
    visible.filter((l) => !l.plot.building).length * 0.1 +
    visible.filter((l) => l.plot.building?.facade.parts.some((p) => p.partId === "deco-palm")).length * 0.35;
  const litter = (street.litter ?? []).filter((l) => l.pos >= from && l.pos <= to);
  const poop = litter.filter((l) => l.kind === "poop").length;
  const anyHomes = street.plots.some((p) => p.purchasedAt !== undefined && p.building && useOf(p.building) === "residential");

  return {
    traffic: 0.45,
    kids: Math.min(1, homes * 0.3 + playgrounds * 0.6),
    bustle: Math.min(1, shops * 0.35),
    birds: Math.min(1, 0.15 + green),
    dog: anyHomes ? 0.5 : 0,
    flies: Math.min(1, poop * 0.45),
  };
}
