import { BOTS, partWeight, personaOf } from "../config/bots";
import type { Bot, NeighborEvent, Neighborhood, OsmStreetRef, Plot, Street, StreetLocation } from "../model/types";
import { generatePlots, layoutKey } from "./claimStreet";
import { createId } from "./ids";
import { personalName } from "./names";
import { hashString, seededRandom } from "./random";
import { randomBuilding } from "./randomBuilding";

const HOUR = 3_600_000;

/** Himmelsrichtung von a nach b in Grad (0 = Osten, 90 = Norden). */
export function bearing(a: Pick<OsmStreetRef, "lat" | "lon">, b: Pick<OsmStreetRef, "lat" | "lon">): number {
  const dy = b.lat - a.lat;
  const dx = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}

/** Verteilt Richtungen so, dass sich Straßen auf der Karte nicht überlappen (mind. `gap` Grad Abstand). */
/** Mindestabstand auf der Karte: bei 5 Straßen passen die Beschriftungen ab ca. 65° nebeneinander. */
export const MIN_BEARING_GAP = 66;

export function spreadBearings(angles: number[], gap = MIN_BEARING_GAP): number[] {
  const points = angles.map((a) => ({ a: ((a % 360) + 360) % 360 }));
  for (let pass = 0; pass < 200 && points.length > 1; pass++) {
    const order = [...points].sort((x, y) => x.a - y.a); // neu sortieren: Schieben kann die Reihenfolge ändern
    let moved = false;
    for (let k = 0; k < order.length; k++) {
      const cur = order[k];
      const next = order[(k + 1) % order.length];
      const diff = (next.a - cur.a + 360) % 360;
      if (diff < gap - 0.5) {
        const push = (gap - diff) / 2;
        cur.a = (cur.a - push + 360) % 360;
        next.a = (next.a + push) % 360;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return points.map((p) => Math.round(p.a) % 360);
}

/** Setzt eine neue Richtung mitten in die größte freie Lücke. */
function largestGapMiddle(angles: number[]): number {
  if (angles.length === 0) return 90;
  const sorted = [...angles].sort((a, b) => a - b);
  let best = { gap: -1, mid: 0 };
  sorted.forEach((a, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360;
    if (next - a > best.gap) best = { gap: next - a, mid: (a + (next - a) / 2) % 360 };
  });
  return best.mid;
}

function botRandom(bot: Bot) {
  return seededRandom(hashString(`${bot.id}#${bot.actions}`));
}

function buildFor(bot: Bot, plot: Plot, random: () => number) {
  const building = randomBuilding(plot.size, random, { weight: (part) => partWeight(bot.character, part.id) });
  const owner = personaOf(bot.character)?.shortName ?? bot.name;
  return { ...building, name: personalName(owner, building.name) };
}

/** Eine Aktion eines Bots: Grundstück kaufen und bebauen, ausbauen oder umbauen. */
export function botAction(
  bot: Bot,
  street: Street,
  at: number,
  { forceBuy = false } = {},
): { bot: Bot; street: Street; event: NeighborEvent } {
  const random = botRandom(bot);
  const free = street.plots.filter((p) => p.purchasedAt === undefined);
  const owned = street.plots.filter((p) => p.purchasedAt !== undefined && p.building);
  const upgradable = owned.filter((p) => p.building!.level < 3);
  const roll = random();
  const pickPlot = (plots: Plot[]) => plots[Math.floor(random() * plots.length)];

  let changed: Plot;
  let text: string;
  if (free.length > 0 && (forceBuy || roll < BOTS.buyChance || upgradable.length === 0)) {
    const plot = pickPlot(free);
    const building = buildFor(bot, plot, random);
    changed = { ...plot, purchasedAt: at, building };
    text = `${bot.name} hat ein ${plot.size}-Grundstück gekauft und „${building.name}“ gebaut.`;
  } else if (upgradable.length > 0 && roll < 0.9) {
    const plot = pickPlot(upgradable);
    const level = (plot.building!.level + 1) as 2 | 3;
    changed = { ...plot, building: { ...plot.building!, level } };
    text = `${bot.name} hat „${plot.building!.name}“ auf Stufe ${level} ausgebaut.`;
  } else {
    const plot = pickPlot(owned);
    const building = { ...buildFor(bot, plot, random), level: plot.building!.level };
    changed = { ...plot, building };
    text = `${bot.name} hat „${plot.building!.name}“ abgerissen und „${building.name}“ gebaut.`;
  }

  return {
    bot: { ...bot, actions: bot.actions + 1 },
    street: { ...street, plots: street.plots.map((p) => (p.id === changed.id ? changed : p)) },
    event: { botId: bot.id, streetId: street.id, at, text },
  };
}

/** Legt die Nachbarschaft an: ein Bot je Persona, echte Nachbarstraßen wenn vorhanden, sonst Fantasienamen. */
export function createNeighborhood(
  playerStreet: Street,
  neighbors: StreetLocation[],
  now: number,
): { neighborhood: Neighborhood; streets: Street[] } {
  const bots: Bot[] = [];
  const streets: Street[] = [];
  const angles: (number | null)[] = [];

  BOTS.personas.forEach((persona, i) => {
    const location = neighbors[i] ?? { name: persona.fallbackStreet, city: playerStreet.city };
    let bot: Bot = {
      id: createId(),
      name: persona.name,
      avatar: persona.avatar,
      character: persona.character,
      streetId: createId(),
      lastActionAt: now,
      actions: 0,
    };
    let street: Street = {
      id: bot.streetId,
      name: location.name,
      city: location.city,
      ...(location.osm && { osm: location.osm }),
      ownerId: bot.id,
      plots: generatePlots(layoutKey(location)),
    };
    for (let k = 0; k < BOTS.startBuildings; k++) ({ bot, street } = botAction(bot, street, now, { forceBuy: true }));
    bots.push(bot);
    streets.push(street);
    angles.push(playerStreet.osm && location.osm ? bearing(playerStreet.osm, location.osm) : null);
  });

  // Echte Straßen liegen in ihrer echten Richtung, Fantasiestraßen füllen die größten Lücken
  // (ohne echte Straßen: gleichmäßig im Kreis, beginnend oben).
  const placed = angles.filter((a): a is number => a !== null);
  const evenly = placed.length === 0;
  const filled = angles.map((a, i) => {
    if (a !== null) return a;
    if (evenly) return 90 + (i * 360) / angles.length;
    const mid = largestGapMiddle(placed);
    placed.push(mid);
    return mid;
  });
  const spread = spreadBearings(filled);
  return {
    neighborhood: {
      playerStreetId: playerStreet.id,
      bots,
      bearings: Object.fromEntries(streets.map((s, i) => [s.id, spread[i]])),
      news: [],
      newsSeenAt: now,
    },
    streets,
  };
}

/** Holt nach, was die Bots seit ihrer letzten Aktion getan hätten („was ist seit dem letzten Besuch passiert“). */
export function simulateNeighborhood(
  neighborhood: Neighborhood,
  streets: Street[],
  now: number,
): { neighborhood: Neighborhood; streets: Street[]; events: NeighborEvent[] } {
  const byId = new Map(streets.map((s) => [s.id, s]));
  const events: NeighborEvent[] = [];

  const bots = neighborhood.bots.map((original) => {
    let bot = original;
    let street = byId.get(bot.streetId);
    if (!street) return bot;
    const interval = BOTS.actionEveryHours[bot.character] * HOUR;
    const due = Math.floor((now - bot.lastActionAt) / interval);
    if (due <= 0) return bot;
    const count = Math.min(due, BOTS.maxCatchUpActions);
    for (let k = due - count; k < due; k++) {
      const result = botAction(bot, street, bot.lastActionAt + (k + 1) * interval);
      ({ bot, street } = result);
      events.push(result.event);
    }
    byId.set(street.id, street);
    return { ...bot, lastActionAt: original.lastActionAt + due * interval };
  });

  const news = [...events, ...neighborhood.news].sort((a, b) => b.at - a.at).slice(0, BOTS.newsLimit);
  return { neighborhood: { ...neighborhood, bots, news }, streets: [...byId.values()], events };
}
