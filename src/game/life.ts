import { LIFE } from "../config/life";
import type { Building, BuildingUse, LitterItem, LitterKind, Player, Plot, Street } from "../model/types";
import { getPart } from "../parts/catalog";
import { createId } from "./ids";
import { hashString, seededRandom } from "./random";

const HOUR = 3_600_000;

/** Nutzung eines Gebäudes; ältere Gebäude ohne Angabe: mit Schild oder Neonschrift = Gewerbe. */
export function useOf(building: Building): BuildingUse {
  if (building.use) return building.use;
  const hasSign = building.facade.parts.some((p) => getPart(p.partId)?.textFill);
  return hasSign ? "commercial" : "residential";
}

const ownedBuildings = (street: Street) =>
  street.plots.filter((p): p is Plot & { building: Building } => p.purchasedAt !== undefined && !!p.building);

export interface StreetStats {
  homes: number;
  shops: number;
  playgrounds: number;
  litter: number;
}

export function streetStats(street: Street): StreetStats {
  const buildings = ownedBuildings(street);
  return {
    homes: buildings.filter((p) => useOf(p.building) === "residential").length,
    shops: buildings.filter((p) => useOf(p.building) === "commercial").length,
    playgrounds: street.plots.filter((p) => p.purchasedAt !== undefined && p.amenity === "playground").length,
    litter: street.litter?.length ?? 0,
  };
}

export interface RentModifiers {
  /** Faktor durch Dreck (1 = sauber). */
  cleanliness: number;
  /** Bonus für Wohnhäuser durch einen Spielplatz. */
  playgroundBonus: number;
  /** Bonus für Gewerbe durch Kundschaft aus Wohnhäusern. */
  customerBonus: number;
}

export function rentModifiers(street: Street): RentModifiers {
  const stats = streetStats(street);
  return {
    cleanliness: 1 - Math.min(LIFE.maxLitterPenalty, stats.litter * LIFE.litterRentPenalty),
    playgroundBonus: stats.playgrounds > 0 ? LIFE.playgroundBonus : 0,
    customerBonus: Math.min(LIFE.maxCustomerBonus, stats.homes * LIFE.customerBonusPerHome),
  };
}

/** Wirkt die Straßen-Lage auf die Grundmiete eines Gebäudes. */
export function applyModifiers(baseRent: number, building: Building, modifiers: RentModifiers): number {
  const bonus = useOf(building) === "residential" ? modifiers.playgroundBonus : modifiers.customerBonus;
  return baseRent * (1 + bonus) * modifiers.cleanliness;
}

// ---------- Müll ----------

function randomSpot(random: () => number): Pick<LitterItem, "pos" | "side"> {
  return { pos: 0.04 + random() * 0.92, side: random() < 0.5 ? "top" : "bottom" };
}

/** Legt ein Stück Dreck hin (falls noch Platz ist). */
export function addLitter(street: Street, kind: LitterKind, spot: Pick<LitterItem, "pos" | "side">): Street {
  const litter = street.litter ?? [];
  if (litter.length >= LIFE.maxLitter) return street;
  return { ...street, litter: [...litter, { id: createId(), kind, ...spot, taps: 0 }] };
}

/**
 * Würfelt nach, was an Müll entstanden ist, während niemand zugeschaut hat.
 * Stundenweise und reproduzierbar (Zufall aus Straßen-ID + Stunde).
 */
export function spawnLitter(street: Street, now: number): Street {
  const since = street.litterCheckedAt ?? now;
  const stats = streetStats(street);
  const firstHour = Math.max(Math.floor(since / HOUR), Math.floor(now / HOUR) - LIFE.maxOfflineHours);
  const lastHour = Math.floor(now / HOUR);
  let result: Street = { ...street, litterCheckedAt: now };
  for (let hour = firstHour + 1; hour <= lastHour; hour++) {
    const random = seededRandom(hashString(`${street.id}@${hour}`));
    const rates: [LitterKind, number][] = [
      ["trash", stats.shops * LIFE.trashPerHourPerShop + stats.homes * LIFE.trashPerHourPerHome],
      ["poop", stats.homes * LIFE.poopPerHourPerHome],
    ];
    for (const [kind, rate] of rates) {
      // Ganzzahliger Anteil sicher, Rest als Wahrscheinlichkeit.
      const count = Math.floor(rate) + (random() < rate % 1 ? 1 : 0);
      for (let i = 0; i < count; i++) result = addLitter(result, kind, randomSpot(random));
    }
  }
  return result;
}

export type CleanResult = { street: Street; cleaned: boolean; reward: number; kind: LitterKind } | null;

/** Einmal auf Dreck tippen. Müll ist sofort weg, Hundehaufen brauchen mehrere Tipper. */
export function tapLitter(street: Street, litterId: string): CleanResult {
  const item = street.litter?.find((l) => l.id === litterId);
  if (!item) return null;
  const taps = item.taps + 1;
  const cleaned = taps >= LIFE.tapsToClean[item.kind];
  const litter = cleaned
    ? street.litter!.filter((l) => l.id !== litterId)
    : street.litter!.map((l) => (l.id === litterId ? { ...l, taps } : l));
  return { street: { ...street, litter }, cleaned, reward: cleaned ? LIFE.cleanReward[item.kind] : 0, kind: item.kind };
}

// ---------- Spielplatz ----------

export type AmenityResult = { ok: true; player: Player; street: Street } | { ok: false; reason: "not-allowed" | "too-expensive" };

/** Legt auf einem eigenen, leeren Grundstück einen Spielplatz an. */
export function buildPlayground(player: Player, street: Street, plotId: string): AmenityResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot || plot.purchasedAt === undefined || plot.building || plot.amenity) return { ok: false, reason: "not-allowed" };
  if (player.coins < LIFE.playgroundCost) return { ok: false, reason: "too-expensive" };
  return {
    ok: true,
    player: { ...player, coins: player.coins - LIFE.playgroundCost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, amenity: "playground" } : p)) },
  };
}

// ---------- Stimmen der Bewohner ----------

export interface Voice {
  id: string;
  emoji: string;
  speaker: string;
  quote: string;
  /** Was das fürs Spiel bedeutet. */
  effect: string;
  tone: "wish" | "complaint" | "praise";
  /** Grundstück, über dem die Sprechblase erscheint. */
  plotId?: string;
}

const pct = (value: number) => `${Math.round(value * 100)} %`;

/** Was Bewohner und Läden gerade zu sagen haben – abgeleitet aus dem Zustand der Straße. */
export function residentVoices(street: Street): Voice[] {
  const stats = streetStats(street);
  const buildings = ownedBuildings(street);
  const homes = buildings.filter((p) => useOf(p.building) === "residential");
  const shops = buildings.filter((p) => useOf(p.building) === "commercial");
  const voices: Voice[] = [];

  if (stats.litter >= LIFE.dirtyThreshold && buildings.length > 0) {
    const speaker = homes[0] ?? shops[0];
    voices.push({
      id: "dirty",
      emoji: "😠",
      speaker: `Bewohner von ${speaker.building.name}`,
      quote: stats.litter >= 8 ? "Das ist ja eine Müllhalde hier! Wir zahlen weniger!" : "Hier liegt überall Müll und Hundekacke …",
      effect: `−${pct(1 - rentModifiers(street).cleanliness)} Miete, bis es sauber ist. Tipp den Dreck auf dem Gehweg an!`,
      tone: "complaint",
      plotId: speaker.id,
    });
  }

  if (homes.length > 0 && stats.playgrounds === 0) {
    voices.push({
      id: "playground",
      emoji: "🧒",
      speaker: `Die Kinder aus ${homes[0].building.name}`,
      quote: "Wir wollen einen Spielplatz! Bitte, bitte!",
      effect: `Leg auf einem freien Grundstück einen Spielplatz an: +${pct(LIFE.playgroundBonus)} Miete für alle Wohnhäuser.`,
      tone: "wish",
      plotId: homes[0].id,
    });
  }

  if (shops.length > 0 && homes.length === 0) {
    voices.push({
      id: "customers",
      emoji: "🏪",
      speaker: shops[0].building.name,
      quote: "Uns fehlen Kunden – hier wohnt ja keiner!",
      effect: `Jedes Wohnhaus bringt Gewerbe +${pct(LIFE.customerBonusPerHome)} Miete (bis +${pct(LIFE.maxCustomerBonus)}).`,
      tone: "wish",
      plotId: shops[0].id,
    });
  }

  if (homes.length > 0 && stats.playgrounds > 0 && stats.litter < LIFE.dirtyThreshold) {
    voices.push({
      id: "happy",
      emoji: "😊",
      speaker: `Bewohner von ${homes[0].building.name}`,
      quote: "Sauber und mit Spielplatz – so wohnt man gern!",
      effect: `Wohnhäuser zahlen +${pct(LIFE.playgroundBonus)} Miete.`,
      tone: "praise",
      plotId: homes[0].id,
    });
  }
  return voices;
}
