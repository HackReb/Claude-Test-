import { badBoy, BAD_BOYS, BOT_MISCHIEF, GRAFFITI_TAGS, MISCHIEF, SECURITY, securityOf, type MischiefKind } from "../config/badboys";
import { carModel } from "../config/cars";
import { CAR_OUTINGS, species } from "../config/pets";
import type { Building, Incident, Mischief, Neighborhood, Player, Plot, Street } from "../model/types";
import { addLitter } from "./life";
import { inStreet, possessive } from "./names";
import { hashString, seededRandom } from "./random";

const HOUR = 3_600_000;

type Built = Plot & { building: Building };
const builtPlots = (street: Street) => street.plots.filter((p): p is Built => p.purchasedAt !== undefined && !!p.building);

const withBuilding = (street: Street, plotId: string, change: Partial<Building>): Street => ({
  ...street,
  plots: street.plots.map((p) => (p.id === plotId && p.building ? { ...p, building: { ...p.building, ...change } } : p)),
});

/** Wer da kommt: ein Bad Boy, ein Tier auf Ausflug oder ein Auto auf Durchfahrt. */
interface Actor {
  id: string;
  name: string;
  emoji: string;
  kind: MischiefKind;
  amount: number;
  /** Tiere und Autos sind ganz offen unterwegs – kein Wachschutz, jeder sieht, wem sie gehören. */
  visitor: boolean;
}

export const isVisitorId = (id: string) => id.startsWith("tier-") || id.startsWith("auto-");

export function actorOf(mischief: Pick<Mischief, "badBoyId" | "label">): Actor {
  const id = mischief.badBoyId;
  if (id.startsWith("tier-")) {
    const sp = species(id.slice(5));
    if (sp) return { id, name: mischief.label ?? `Ein ${sp.name}`, emoji: sp.emoji, kind: "poop", amount: sp.poopPerOuting, visitor: true };
  }
  if (id.startsWith("auto-")) {
    const model = carModel(id.slice(5));
    if (model) return { id, name: mischief.label ?? `Ein ${model.brand} ${model.model}`, emoji: "🚗", kind: "soot", amount: model.soot, visitor: true };
  }
  if (id === "aliens") return { id, name: "Aliens", emoji: "👽", kind: "smash", amount: 1, visitor: false };
  const bb = badBoy(id) ?? BAD_BOYS[0];
  return { ...bb, visitor: false };
}

/** Fängt der Wachschutz der Straße diesen Bad Boy ab? Reproduzierbar über die ID des Streichs. */
export function rollBlocked(street: Street, mischiefId: string): boolean {
  const guard = securityOf(street.security);
  return !!guard && seededRandom(hashString(`${mischiefId}#guard`))() < guard.blockChance;
}

/** Text für Neuigkeiten und Zeitung – mit den Namen der Häuser. */
function describe(bb: Actor, mischief: Mischief, street: Street, detail: { count?: number; tag?: string; building?: string }): string {
  if (bb.visitor && bb.kind === "poop") return `${bb.name} war ${inStreet(street.name)} spazieren: ${detail.count} Haufen. Igitt!`;
  if (bb.kind === "soot")
    return detail.building
      ? `${bb.name} ist ${inStreet(street.name)} durchgebraust – Ruß an ${detail.building}.`
      : `${bb.name} ist ${inStreet(street.name)} durchgebraust.`;
  if (mischief.blocked) {
    const guard = securityOf(street.security)?.name ?? "Der Wachschutz";
    return `${guard} hat ${bb.name} erwischt${mischief.senderName ? ` – geschickt von ${mischief.senderName}!` : "!"}`;
  }
  switch (bb.kind) {
    case "poop":
      return `${bb.name} war ${inStreet(street.name)} Gassi: ${detail.count} Hundehaufen auf dem Gehweg. Igitt!`;
    case "graffiti":
      return detail.building
        ? `${bb.name} hat „${detail.tag}“ an ${detail.building} gesprüht.`
        : `${bb.name} hat nichts zum Besprühen gefunden und aus Frust Müll verteilt.`;
    case "smash":
      return detail.building ? `${bb.name}: Fenster kaputt bei ${detail.building}!` : `${bb.name} haben nur Krach gemacht – nichts kaputt.`;
    default:
      return `${bb.name} hat ${inStreet(street.name)} ${detail.count}× Müll verteilt.`;
  }
}

/**
 * Ein Bad Boy kommt in der Straße an und stellt etwas an (oder der Wachschutz fängt ihn ab).
 * Reproduzierbar über die ID; zweimal derselbe Streich ändert nichts.
 */
export function applyMischief(street: Street, mischief: Mischief): { street: Street; incident: Incident | null } {
  if (street.incidents?.some((i) => i.id === mischief.id)) return { street, incident: null };
  const bb = actorOf(mischief);
  // Tiere und Autos lässt jeder Wachschutz durch.
  if (bb.visitor) mischief = { ...mischief, blocked: false };
  const random = seededRandom(hashString(mischief.id));
  const spot = () => ({ pos: 0.04 + random() * 0.92, side: random() < 0.5 ? ("top" as const) : ("bottom" as const) });
  let result = street;
  const detail: { count?: number; tag?: string; building?: string } = {};

  if (!mischief.blocked) {
    const buildings = builtPlots(street);
    const pick = (plots: Built[]) => plots[Math.floor(random() * plots.length)];
    if (bb.kind === "trash" || bb.kind === "poop") {
      const before = result.litter?.length ?? 0;
      for (let i = 0; i < bb.amount; i++) result = addLitter(result, bb.kind === "poop" ? "poop" : "trash", spot());
      detail.count = (result.litter?.length ?? 0) - before;
    } else if (bb.kind === "graffiti") {
      const clean = buildings.filter((p) => !p.building.graffiti);
      const target = pick(clean.length > 0 ? clean : buildings);
      if (target) {
        detail.tag = GRAFFITI_TAGS[Math.floor(random() * GRAFFITI_TAGS.length)];
        detail.building = target.building.name;
        result = withBuilding(result, target.id, { graffiti: detail.tag });
      } else {
        for (let i = 0; i < 2; i++) result = addLitter(result, "trash", spot());
      }
    } else if (bb.kind === "soot") {
      const target = pick(buildings);
      if (target && bb.amount > 0) {
        detail.building = target.building.name;
        result = withBuilding(result, target.id, { soot: Math.min(CAR_OUTINGS.maxSoot, (target.building.soot ?? 0) + bb.amount) });
      }
    } else {
      const whole = buildings.filter((p) => !p.building.damaged);
      const target = pick(whole);
      if (target) {
        detail.building = target.building.name;
        result = withBuilding(result, target.id, { damaged: true });
      }
    }
  }

  const incident: Incident = {
    id: mischief.id,
    at: mischief.at,
    badBoyId: bb.id,
    blocked: mischief.blocked,
    text: describe(bb, mischief, street, detail),
    // Wer ihn geschickt hat, kommt nur raus, wenn er erwischt wurde – bei Tieren und Autos sieht man's sowieso.
    ...((mischief.blocked || bb.visitor) && mischief.senderName && { senderName: mischief.senderName }),
  };
  return { street: { ...result, incidents: [incident, ...(result.incidents ?? [])].slice(0, MISCHIEF.incidentLimit) }, incident };
}

// ---------- Aufräumen, Reparieren, Wachschutz ----------

export type FixResult = { ok: true; player: Player; street: Street; cost: number } | { ok: false; reason: "not-needed" | "too-expensive" };

export function scrubGraffiti(player: Player, street: Street, plotId: string): FixResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot?.building?.graffiti) return { ok: false, reason: "not-needed" };
  const cost = MISCHIEF.scrubCost;
  if (player.coins < cost) return { ok: false, reason: "too-expensive" };
  const { graffiti: _removed, ...building } = plot.building;
  return {
    ok: true,
    cost,
    player: { ...player, coins: player.coins - cost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building } : p)) },
  };
}

export function repairBuilding(player: Player, street: Street, plotId: string): FixResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot?.building?.damaged) return { ok: false, reason: "not-needed" };
  const cost = MISCHIEF.repairCost[plot.size];
  if (player.coins < cost) return { ok: false, reason: "too-expensive" };
  const { damaged: _removed, ...building } = plot.building;
  return {
    ok: true,
    cost,
    player: { ...player, coins: player.coins - cost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building } : p)) },
  };
}

export function washFacade(player: Player, street: Street, plotId: string): FixResult {
  const plot = street.plots.find((p) => p.id === plotId);
  if (!plot?.building?.soot) return { ok: false, reason: "not-needed" };
  const cost = CAR_OUTINGS.washCost;
  if (player.coins < cost) return { ok: false, reason: "too-expensive" };
  const { soot: _removed, ...building } = plot.building;
  return {
    ok: true,
    cost,
    player: { ...player, coins: player.coins - cost },
    street: { ...street, plots: street.plots.map((p) => (p.id === plotId ? { ...p, building } : p)) },
  };
}

/** Nächste Wachschutz-Stufe für die eigene Straße. */
export function nextSecurity(street: Street) {
  return SECURITY.find((s) => s.level === (street.security ?? 0) + 1) ?? null;
}

export function buySecurity(player: Player, street: Street): FixResult {
  const next = nextSecurity(street);
  if (!next) return { ok: false, reason: "not-needed" };
  if (player.coins < next.price) return { ok: false, reason: "too-expensive" };
  return { ok: true, cost: next.price, player: { ...player, coins: player.coins - next.price }, street: { ...street, security: next.level } };
}

// ---------- Bots schicken auch mal jemanden ----------

/**
 * Was die Bots seit dem letzten Besuch zum Spieler geschickt haben – reproduzierbar je Bot.
 * Liefert die Streiche mit Zeitpunkt; angewendet werden sie in der Simulation.
 */
export function botMischief(neighborhood: Neighborhood, playerStreet: Street, now: number): { neighborhood: Neighborhood; mischief: Mischief[] } {
  const mischief: Mischief[] = [];
  const bots = neighborhood.bots.map((bot) => {
    const every = BOT_MISCHIEF.everyHours[bot.character];
    if (!every) return bot;
    let next = bot.nextMischiefAt ?? now + every * HOUR; // neue Nachbarschaft: erst mal Ruhe
    let count = 0;
    while (next <= now && count < BOT_MISCHIEF.maxCatchUp) {
      const id = `bot-${bot.id}-${next}`;
      const random = seededRandom(hashString(id));
      const favorites = BOT_MISCHIEF.favorites[bot.character] ?? [BAD_BOYS[0].id];
      const badBoyId = favorites[Math.floor(random() * favorites.length)];
      const visitor = isVisitorId(badBoyId);
      const actor = actorOf({ badBoyId });
      mischief.push({
        id,
        badBoyId,
        at: next,
        blocked: visitor ? false : rollBlocked(playerStreet, id),
        senderName: bot.name,
        ...(visitor && { label: `${possessive(bot.name)} ${actor.name.replace(/^Ein /, "")}` }),
      });
      next += every * HOUR * (0.75 + random() * 0.5);
      count++;
    }
    // Nach langer Abwesenheit nicht alles auf einmal nachholen.
    if (next <= now) next = now + every * HOUR;
    return { ...bot, nextMischiefAt: next };
  });
  return { neighborhood: { ...neighborhood, bots }, mischief };
}

/** Wer einen Bot ärgert, bekommt bald Besuch zurück. */
export function provokeBot(neighborhood: Neighborhood, streetId: string, now: number): Neighborhood {
  const revenge = now + BOT_MISCHIEF.revengeAfterHours * HOUR;
  return {
    ...neighborhood,
    bots: neighborhood.bots.map((b) =>
      b.streetId === streetId && BOT_MISCHIEF.revengeful.includes(b.character) && (b.nextMischiefAt ?? Infinity) > revenge
        ? { ...b, nextMischiefAt: revenge }
        : b,
    ),
  };
}
