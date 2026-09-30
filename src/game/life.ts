import { capacityOf, ECONOMY } from "../config/economy";
import { MISCHIEF } from "../config/badboys";
import { LIFE } from "../config/life";
import { CAR_OUTINGS } from "../config/pets";
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
  graffiti: number;
  damaged: number;
  /** Ruß-Stufen an allen Fassaden zusammen. */
  soot: number;
}

export function streetStats(street: Street): StreetStats {
  const buildings = ownedBuildings(street);
  return {
    homes: buildings.filter((p) => useOf(p.building) === "residential").length,
    shops: buildings.filter((p) => useOf(p.building) === "commercial").length,
    playgrounds: street.plots.filter((p) => p.purchasedAt !== undefined && p.amenity === "playground").length,
    litter: street.litter?.length ?? 0,
    graffiti: buildings.filter((p) => p.building.graffiti).length,
    damaged: buildings.filter((p) => p.building.damaged).length,
    soot: buildings.reduce((sum, p) => sum + (p.building.soot ?? 0), 0),
  };
}

// ---------- Bewohner & Wohlfühl-Liste ----------

export type NeedId = "clean" | "playground" | "shop";

/** Ein Punkt der Wohlfühl-Liste: erfüllt → Häuser können voll werden, sonst ziehen Leute aus. */
export interface Need {
  id: NeedId;
  label: string;
  met: boolean;
  /** Höchste Belegung, die dieser Punkt erlaubt (1 = keine Einschränkung). */
  factor: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Wohlfühl-Liste für Wohnhäuser in dieser Straße.
 * `dirtTolerance` < 1: modernisierte Häuser – Dreck drückt die Belegung weniger.
 */
export function streetNeeds(street: Street, dirtTolerance = 1): Need[] {
  const stats = streetStats(street);
  // Graffiti stört wie mehrere Dreck-Teile.
  const dirt = stats.litter + stats.graffiti * MISCHIEF.graffitiAsLitter + stats.soot * CAR_OUTINGS.sootAsLitter;
  const cleanliness = Math.max(LIFE.minCleanliness, 1 - dirt * LIFE.litterComfortLoss * dirtTolerance);
  const what = [stats.litter > 0 && `${stats.litter}× Dreck`, stats.graffiti > 0 && `${stats.graffiti}× Graffiti`, stats.soot > 0 && `${stats.soot}× Ruß`]
    .filter(Boolean)
    .join(", ");
  return [
    {
      id: "clean",
      label: dirt === 0 ? "Straße sauber" : dirt < LIFE.dirtyThreshold ? `Fast sauber (${what})` : `${what} in der Straße`,
      met: dirt < LIFE.dirtyThreshold,
      factor: cleanliness,
    },
    { id: "playground", label: "Spielplatz für die Kinder", met: stats.playgrounds > 0, factor: stats.playgrounds > 0 ? 1 : LIFE.noPlaygroundFactor },
    { id: "shop", label: "Laden zum Einkaufen", met: stats.shops > 0, factor: stats.shops > 0 ? 1 : LIFE.noShopFactor },
  ];
}

/** Wie voll Wohnhäuser hier höchstens werden (0–1). */
export function homeComfort(street: Street, dirtTolerance = 1): number {
  return streetNeeds(street, dirtTolerance).reduce((product, need) => product * need.factor, 1);
}

/** Plätze eines Gebäudes (Bewohner bzw. Kunden). */
export const placesOf = (plot: Plot & { building: Building }) => capacityOf(plot.size, plot.building.level, useOf(plot.building));

/** Aktuelle Belegung; ohne gespeicherten Wert (alte Stände, Bots) das, was die Straße hergibt. */
export function occupancyOf(street: Street, plot: Plot & { building: Building }): number {
  return plot.building.occupancy ?? targetOccupancy(street, plot);
}

/** Bewohner der Straße insgesamt (Kundschaft für die Läden). */
export function residentsOf(street: Street): number {
  return ownedBuildings(street)
    .filter((p) => useOf(p.building) === "residential")
    .reduce((sum, p) => sum + placesOf(p) * (p.building.occupancy ?? homeComfort(street)), 0);
}

/** Bewohner je Wohnhaus (Grundstücks-ID → Anzahl, auf eine Stelle gerundet) – so viele Leute gehören auf die Straße. */
export function residentsByPlot(street: Street): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of ownedBuildings(street)) {
    if (useOf(p.building) !== "residential") continue;
    result[p.id] = Math.round(placesOf(p) * (p.building.occupancy ?? homeComfort(street)) * 10) / 10;
  }
  return result;
}

/** Wie viele Plätze die Läden der Straße zusammen haben. */
function shopPlacesOf(street: Street): number {
  return ownedBuildings(street)
    .filter((p) => useOf(p.building) === "commercial")
    .reduce((sum, p) => sum + placesOf(p), 0);
}

/** Wohin sich die Belegung eines Gebäudes gerade bewegt (0–1). */
export function targetOccupancy(street: Street, plot: Plot & { building: Building }): number {
  // Kaputte Fenster: da will keiner wohnen oder einkaufen, bis repariert ist.
  const damage = plot.building.damaged ? MISCHIEF.damagedFactor : 1;
  if (useOf(plot.building) === "residential") return homeComfort(street, ECONOMY.upgradeLevels[plot.building.level].dirtTolerance) * damage;
  const litter = street.litter?.length ?? 0;
  const cleanliness = Math.max(LIFE.shopMinCleanliness, 1 - litter * LIFE.shopLitterLoss);
  const demand = shopPlacesOf(street);
  const customers = demand > 0 ? Math.min(1, residentsOf(street) / demand) : 0;
  return clamp01(cleanliness * damage * (LIFE.walkInCustomers + (1 - LIFE.walkInCustomers) * customers));
}

/** Belegung nach `hours` Stunden: Einziehen geht schneller als Ausziehen. */
export function moveTowards(current: number, target: number, hours: number): number {
  if (current < target) return Math.min(target, current + LIFE.moveInPerHour * hours);
  return Math.max(target, current - LIFE.moveOutPerHour * hours);
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
  const firstHour = Math.max(Math.floor(since / HOUR), Math.floor(now / HOUR) - ECONOMY.maxOfflineHours);
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

export type CleanResult = { street: Street; cleaned: boolean; kind: LitterKind } | null;

/** Einmal auf Dreck tippen. Müll ist sofort weg, Hundehaufen brauchen mehrere Tipper. */
export function tapLitter(street: Street, litterId: string): CleanResult {
  const item = street.litter?.find((l) => l.id === litterId);
  if (!item) return null;
  const taps = item.taps + 1;
  const cleaned = taps >= LIFE.tapsToClean[item.kind];
  const litter = cleaned
    ? street.litter!.filter((l) => l.id !== litterId)
    : street.litter!.map((l) => (l.id === litterId ? { ...l, taps } : l));
  return { street: { ...street, litter }, cleaned, kind: item.kind };
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
  const needs = Object.fromEntries(streetNeeds(street).map((n) => [n.id, n])) as Record<NeedId, Need>;
  const voices: Voice[] = [];

  if (!needs.clean.met && buildings.length > 0) {
    const speaker = homes[0] ?? shops[0];
    voices.push({
      id: "dirty",
      emoji: "😠",
      speaker: `Bewohner von ${speaker.building.name}`,
      quote:
        stats.graffiti > 0 && stats.litter < LIFE.dirtyThreshold
          ? "Wer hat denn unsere Hauswand vollgeschmiert?!"
          : stats.litter >= 8
            ? "Das ist ja eine Müllhalde hier! Wir ziehen weg!"
            : "Hier liegt überall Müll und Hundekacke …",
      effect: `Häuser werden höchstens zu ${pct(needs.clean.factor)} voll, bis es sauber ist – die Leute ziehen aus. Tipp den Dreck auf dem Gehweg an!`,
      tone: "complaint",
      plotId: speaker.id,
    });
  }

  if (homes.length > 0 && !needs.playground.met) {
    voices.push({
      id: "playground",
      emoji: "🧒",
      speaker: `Die Kinder aus ${homes[0].building.name}`,
      quote: "Wir wollen einen Spielplatz! Sonst ziehen wir weg!",
      effect: `Ohne Spielplatz werden Wohnhäuser höchstens zu ${pct(LIFE.noPlaygroundFactor)} voll. Leg auf einem freien Grundstück einen an.`,
      tone: "wish",
      plotId: homes[0].id,
    });
  }

  if (homes.length > 0 && !needs.shop.met) {
    voices.push({
      id: "shop",
      emoji: "🛒",
      speaker: `Bewohner von ${homes[0].building.name}`,
      quote: "Wo sollen wir denn hier einkaufen?",
      effect: `Ohne Laden werden Wohnhäuser höchstens zu ${pct(LIFE.noShopFactor)} voll. Bau einen Laden, Kiosk oder Supermarkt.`,
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
      effect: `Ohne Bewohner kommt nur Laufkundschaft (${pct(LIFE.walkInCustomers)}). Bau Wohnhäuser – Bewohner kaufen in deinen Läden ein.`,
      tone: "wish",
      plotId: shops[0].id,
    });
  }

  const broken = buildings.find((p) => p.building.damaged);
  if (broken) {
    voices.push({
      id: "damaged",
      emoji: "🪟",
      speaker: `Bewohner von ${broken.building.name}`,
      quote: "Uns hat jemand das Fenster eingeworfen! Es zieht!",
      effect: `Kaputte Häuser füllen sich höchstens zu ${pct(MISCHIEF.damagedFactor)} – lass es reparieren (tipp das Haus an).`,
      tone: "complaint",
      plotId: broken.id,
    });
  }

  if (homes.length > 0 && needs.playground.met && needs.shop.met && needs.clean.met) {
    voices.push({
      id: "happy",
      emoji: "😊",
      speaker: `Bewohner von ${homes[0].building.name}`,
      quote: "Sauber, Spielplatz, Laden um die Ecke – hier bleiben wir!",
      effect: "Alles erfüllt: Deine Häuser füllen sich bis unters Dach.",
      tone: "praise",
      plotId: homes[0].id,
    });
  }
  return voices;
}
