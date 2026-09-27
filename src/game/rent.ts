import { capacityOf, ECONOMY, rentLevel, upkeepOf } from "../config/economy";
import type { Building, Incident, Mischief, Player, Plot, PlotSize, Street } from "../model/types";
import { moveTowards, occupancyOf, spawnLitter, targetOccupancy, useOf } from "./life";
import { securityOf } from "../config/badboys";
import { applyMischief } from "./mischief";
import { petUpkeepPerHour } from "./pets";
import { belongsTo } from "./plots";
import { getPart } from "../parts/catalog";

const HOUR = 3_600_000;

type Built = Plot & { building: Building };
const isBuilt = (plot: Plot): plot is Built => plot.purchasedAt !== undefined && !!plot.building;

/** Mietniveau durch die Fassade (Deko, Stockwerke). */
export function buildingRentLevel(building: Building): number {
  const { facade } = building;
  const partsBonus = [facade.base, facade.roof, ...facade.parts].reduce((sum, ref) => sum + (getPart(ref.partId)?.rentBonus ?? 0), 0);
  return rentLevel(facade.floors, partsBonus);
}

/** Einnahmen eines Gebäudes pro Stunde bei der Belegung `occupancy` (1 = voll). */
export function buildingIncomePerHour(size: PlotSize, building: Building, occupancy = 1): number {
  const perPlace = useOf(building) === "residential" ? ECONOMY.rentPerResidentPerHour : ECONOMY.revenuePerCustomerPerHour;
  return capacityOf(size, building.level) * occupancy * perPlace * buildingRentLevel(building);
}

/** Einnahmen eines Grundstücks pro Stunde bei seiner aktuellen Belegung. */
export function plotIncomePerHour(street: Street, plot: Plot): number {
  return isBuilt(plot) ? buildingIncomePerHour(plot.size, plot.building, occupancyOf(street, plot)) : 0;
}

/** Laufende Kosten eines Grundstücks pro Stunde (Gebäude oder Spielplatz; leere Grundstücke kosten nichts). */
export function plotUpkeepPerHour(plot: Plot): number {
  if (plot.purchasedAt === undefined) return 0;
  if (plot.building) return upkeepOf(plot.size, plot.building.level);
  return plot.amenity === "playground" ? ECONOMY.playgroundUpkeepPerHour : 0;
}

/** Einnahmen, die `ownerId` in dieser Straße pro Stunde hat (Standard: der Besitzer der Straße). */
export function streetIncomePerHour(street: Street, ownerId: string = street.ownerId): number {
  return street.plots.reduce((sum, plot) => (belongsTo(street, plot, ownerId) ? sum + plotIncomePerHour(street, plot) : sum), 0);
}

/** Laufende Kosten des Wachschutzes einer Straße (zahlt der Besitzer). */
export function securityUpkeepPerHour(street: Street): number {
  return securityOf(street.security)?.upkeepPerHour ?? 0;
}

export function streetUpkeepPerHour(street: Street, ownerId: string = street.ownerId): number {
  const plots = street.plots.reduce((sum, plot) => (belongsTo(street, plot, ownerId) ? sum + plotUpkeepPerHour(plot) : sum), 0);
  return plots + (ownerId === street.ownerId ? securityUpkeepPerHour(street) : 0);
}

/** Einnahmen eines Spielers über alle Straßen (eigene + Grundstücke bei Nachbarn). */
export function playerIncomePerHour(streets: Street[], playerId: string): number {
  return streets.reduce((sum, s) => sum + streetIncomePerHour(s, playerId), 0);
}

export function playerUpkeepPerHour(streets: Street[], playerId: string): number {
  return streets.reduce((sum, s) => sum + streetUpkeepPerHour(s, playerId), 0);
}

export interface Simulation {
  /** Miete in `pendingRent`, Kosten vom Konto abgebucht, `lastSeen` = jetzt. */
  player: Player;
  /** Dieselben Straßen in derselben Reihenfolge – mit neuer Belegung (und Müll in der eigenen Straße). */
  streets: Street[];
  income: number;
  upkeep: number;
  /** Ein- und ausgezogene Bewohner (Wohnhäuser, gerundet erst in der Anzeige). */
  movedIn: number;
  movedOut: number;
  /** Was Bad Boys in der eigenen Straße angestellt haben. */
  incidents: Incident[];
}

/**
 * Lässt die Zeit seit `player.lastSeen` vergehen – Stunde für Stunde, damit sich Müll, Bewohner, Miete
 * und Kosten gegenseitig beeinflussen (vermüllt die Straße über Nacht, ziehen Leute aus und die Miete sinkt).
 * Belegung ändert der Spieler nur bei eigenen Gebäuden; Müll entsteht nur in seiner eigenen Straße.
 */
export function simulate(player: Player, streets: Street[], now: number, incoming: Mischief[] = []): Simulation {
  const result: Simulation = { player, streets, income: 0, upkeep: 0, movedIn: 0, movedOut: 0, incidents: [] };
  // Bad Boys, die in der eigenen Straße ankommen – zu ihrer Zeit (verspätet eingetroffene sofort).
  const pending = [...incoming].sort((a, b) => a.at - b.at);
  const arrive = (street: Street, until: number): Street => {
    let current = street;
    while (pending.length > 0 && pending[0].at <= until) {
      const applied = applyMischief(current, pending.shift()!);
      current = applied.street;
      if (applied.incident) result.incidents.push(applied.incident);
    }
    return current;
  };
  if (now <= player.lastSeen) {
    if (pending.length === 0) return result;
    const own = streets.map((s) => (s.id === player.streetId ? arrive(s, Infinity) : s));
    return { ...result, streets: own };
  }

  let current = streets;
  let t = Math.max(player.lastSeen, now - ECONOMY.maxOfflineHours * HOUR);
  while (t < now) {
    const next = Math.min(now, (Math.floor(t / HOUR) + 1) * HOUR);
    const hours = (next - t) / HOUR;
    current = current.map((street) => {
      const withLitter = street.id === player.streetId ? arrive(spawnLitter(street, t), t) : street;
      let changed = withLitter !== street;
      const plots = withLitter.plots.map((plot) => {
        if (!belongsTo(withLitter, plot, player.id)) return plot;
        result.upkeep += plotUpkeepPerHour(plot) * hours;
        if (!isBuilt(plot)) return plot;
        const before = occupancyOf(withLitter, plot);
        const after = moveTowards(before, targetOccupancy(withLitter, plot), hours);
        // Mittel aus vorher und nachher: Einziehen geht schnell, innerhalb einer Stunde ändert sich viel.
        result.income += buildingIncomePerHour(plot.size, plot.building, (before + after) / 2) * hours;
        if (useOf(plot.building) === "residential") {
          const people = (after - before) * capacityOf(plot.size, plot.building.level);
          if (people > 0) result.movedIn += people;
          else result.movedOut -= people;
        }
        if (after === plot.building.occupancy) return plot;
        changed = true;
        return { ...plot, building: { ...plot.building, occupancy: after } };
      });
      if (street.ownerId === player.id) result.upkeep += securityUpkeepPerHour(street) * hours;
      return changed ? { ...withLitter, plots } : street;
    });
    // Futter & Tierarzt für die eigenen Tiere.
    result.upkeep += petUpkeepPerHour(player) * hours;
    t = next;
  }
  // Müll bis genau jetzt nachwürfeln (volle Stunden), übrige Bad Boys kommen jetzt an.
  current = current.map((street) => (street.id === player.streetId ? arrive(spawnLitter(street, now), Infinity) : street));

  return {
    ...result,
    streets: current,
    player: {
      ...player,
      pendingRent: player.pendingRent + result.income,
      coins: player.coins - result.upkeep,
      lastSeen: now,
    },
  };
}

/** Überträgt die ganzen Münzen aus `pendingRent` auf das Konto; Bruchteile bleiben stehen. */
export function collectRent(player: Player): { player: Player; collected: number } {
  const collected = Math.floor(player.pendingRent);
  return {
    player: { ...player, coins: player.coins + collected, pendingRent: player.pendingRent - collected },
    collected,
  };
}
