import { describe, expect, it } from "vitest";
import { BAD_BOYS, MISCHIEF, SECURITY } from "../config/badboys";
import { LIFE } from "../config/life";
import type { Mischief, Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { createNeighborhood } from "./bots";
import { homeComfort, targetOccupancy } from "./life";
import { applyMischief, botMischief, buySecurity, provokeBot, repairBuilding, rollBlocked, scrubGraffiti } from "./mischief";
import { buyPlot, placeBuilding } from "./plots";
import { playerUpkeepPerHour, simulate } from "./rent";
import { buildingFromTemplate, TEMPLATES } from "./templates";

const HOUR = 3_600_000;
const tpl = (id: string) => buildingFromTemplate(TEMPLATES.find((t) => t.id === id)!);

function street() {
  const s = claimStreet({ playerName: "Kalle", street: { name: "Bahnhofstraße", city: "Tuttlingen" } }, 0);
  const plot = s.street.plots.find((p) => p.size === "M" && p.purchasedAt === undefined)!;
  const bought = buyPlot({ ...s.player, coins: 1e6 }, s.street, plot.id, 0);
  if (!bought.ok) throw new Error();
  const withHome = placeBuilding(bought.street, plot.id, tpl("wohnhaus"))!;
  return { player: { ...s.player, streetId: "kalles-weg" }, street: { ...withHome, id: "kalles-weg" } as Street, homeId: plot.id };
}

const send = (badBoyId: string, id = `m-${badBoyId}`, extra: Partial<Mischief> = {}): Mischief => ({ id, badBoyId, at: 5, blocked: false, ...extra });

describe("Bad Boys", () => {
  it("Mülltonnen-Marvin verteilt Müll, Gassi-Gabi Hundehaufen – mit Namen in der Meldung", () => {
    const { street: s } = street();
    const marvin = applyMischief(s, send("muelltonnen-marvin"));
    expect(marvin.street.litter).toHaveLength(6);
    expect(marvin.incident!.text).toBe("Mülltonnen-Marvin hat in der Bahnhofstraße 6× Müll verteilt.");
    const gabi = applyMischief(s, send("gassi-gabi"));
    expect(gabi.street.litter!.every((l) => l.kind === "poop")).toBe(true);
    expect(gabi.incident!.text).toContain("Igitt!");
  });

  it("Sprühdosen-Kevin besprüht ein Haus – das stört die Bewohner wie Dreck", () => {
    const { street: s } = street();
    const kevin = applyMischief(s, send("spruehdosen-kevin"));
    const sprayed = kevin.street.plots.find((p) => p.building?.graffiti)!;
    expect(kevin.incident!.text).toBe(`Sprühdosen-Kevin hat „${sprayed.building!.graffiti}“ an ${sprayed.building!.name} gesprüht.`);
    expect(homeComfort(kevin.street)).toBeCloseTo(homeComfort(s) * (1 - MISCHIEF.graffitiAsLitter * LIFE.litterComfortLoss));
  });

  it("Knallfrösche: Fenster kaputt → Haus füllt sich nur noch halb, bis repariert ist", () => {
    const { player, street: s, homeId } = street();
    const twins = applyMischief({ ...s, plots: s.plots.map((p) => (p.id !== homeId && p.building ? { ...p, building: { ...p.building, damaged: true } } : p)) }, send("knallfrosch-zwillinge"));
    const home = twins.street.plots.find((p) => p.id === homeId)! as Parameters<typeof targetOccupancy>[1];
    expect(home.building.damaged).toBe(true);
    expect(targetOccupancy(twins.street, home)).toBeCloseTo(homeComfort(twins.street) * MISCHIEF.damagedFactor);

    const repaired = repairBuilding({ ...player, coins: 500 }, twins.street, homeId);
    if (!repaired.ok) throw new Error(repaired.reason);
    expect(repaired.cost).toBe(MISCHIEF.repairCost.M);
    expect(repaired.street.plots.find((p) => p.id === homeId)!.building!.damaged).toBeUndefined();
    expect(repairBuilding({ ...player, coins: 5 }, twins.street, homeId)).toEqual({ ok: false, reason: "too-expensive" });
  });

  it("Graffiti wegschrubben kostet Reinigungsmittel", () => {
    const { player, street: s } = street();
    const kevin = applyMischief(s, send("spruehdosen-kevin"));
    const plotId = kevin.street.plots.find((p) => p.building?.graffiti)!.id;
    const scrubbed = scrubGraffiti({ ...player, coins: 100 }, kevin.street, plotId);
    if (!scrubbed.ok) throw new Error();
    expect(scrubbed.player.coins).toBe(100 - MISCHIEF.scrubCost);
    expect(scrubbed.street.plots.find((p) => p.id === plotId)!.building!.graffiti).toBeUndefined();
    expect(scrubGraffiti(player, scrubbed.street, plotId)).toEqual({ ok: false, reason: "not-needed" });
  });

  it("derselbe Streich wirkt nur einmal", () => {
    const { street: s } = street();
    const once = applyMischief(s, send("kaugummi-klaus"));
    const twice = applyMischief(once.street, send("kaugummi-klaus"));
    expect(twice.incident).toBeNull();
    expect(twice.street).toBe(once.street);
  });
});

describe("Wachschutz", () => {
  it("kostet, hat laufende Kosten und fängt einen Teil ab – dann kommt raus, wer geschickt hat", () => {
    const { player, street: s } = street();
    const guard = buySecurity({ ...player, coins: 1000 }, s);
    if (!guard.ok) throw new Error();
    expect(guard.player.coins).toBe(1000 - SECURITY[0].price);
    expect(playerUpkeepPerHour([guard.street], player.id) - playerUpkeepPerHour([s], player.id)).toBe(SECURITY[0].upkeepPerHour);

    const outcomes = Array.from({ length: 200 }, (_, i) => rollBlocked(guard.street, `versuch-${i}`));
    const share = outcomes.filter(Boolean).length / outcomes.length;
    expect(share).toBeGreaterThan(SECURITY[0].blockChance - 0.12);
    expect(share).toBeLessThan(SECURITY[0].blockChance + 0.12);
    expect(rollBlocked(s, "versuch-1")).toBe(false); // ohne Wachschutz

    const caught = applyMischief(guard.street, send("spruehdosen-kevin", "m1", { blocked: true, senderName: "Maxim" }));
    expect(caught.street.plots.some((p) => p.building?.graffiti)).toBe(false);
    expect(caught.incident).toMatchObject({ blocked: true, senderName: "Maxim", text: "Nachbarschaftswache hat Sprühdosen-Kevin erwischt – geschickt von Maxim!" });
    const unseen = applyMischief(guard.street, send("spruehdosen-kevin", "m2", { senderName: "Maxim" }));
    expect(unseen.incident!.senderName).toBeUndefined();
  });
});

describe("in der Simulation", () => {
  it("Bad Boys kommen zu ihrer Zeit an und drücken ab dann die Belegung", () => {
    const { player, street: s } = street();
    const full: Street = { ...s, plots: s.plots.map((p) => (p.building ? { ...p, building: { ...p.building, occupancy: 0.7 } } : p)) };
    const quiet = simulate(player, [full], 10 * HOUR);
    const attacked = simulate(player, [full], 10 * HOUR, [send("knallfrosch-zwillinge", "boom", { at: 2 * HOUR }), send("muelltonnen-marvin", "tonne", { at: 3 * HOUR })]);
    // Welches Haus es trifft, entscheidet der Zufall des Streichs – belegt ist danach insgesamt weniger.
    const occ = (r: typeof quiet) => r.streets[0].plots.reduce((sum, p) => sum + (p.building?.occupancy ?? 0), 0);
    expect(attacked.incidents.map((i) => i.id)).toEqual(["boom", "tonne"]);
    expect(occ(attacked)).toBeLessThan(occ(quiet));
    expect(attacked.income).toBeLessThan(quiet.income);
    expect(attacked.streets[0].incidents).toHaveLength(2);
  });

  it("Bots mit Charakter schicken ab und zu jemanden – reproduzierbar, Rache kommt schneller", () => {
    const { street: s } = street();
    const { neighborhood } = createNeighborhood(s, [], 0);
    const first = botMischief(neighborhood, s, 0);
    expect(first.mischief).toEqual([]); // neue Nachbarschaft: erst mal Ruhe
    const later = botMischief(first.neighborhood, s, 3 * 24 * HOUR);
    expect(later.mischief.length).toBeGreaterThan(0);
    expect(later.mischief.every((m) => BAD_BOYS.some((b) => b.id === m.badBoyId))).toBe(true);
    expect(botMischief(first.neighborhood, s, 3 * 24 * HOUR)).toEqual(later);
    const chaos = first.neighborhood.bots.find((b) => b.character === "chaos")!;
    const provoked = provokeBot(first.neighborhood, chaos.streetId, 0);
    expect(provoked.bots.find((b) => b.id === chaos.id)!.nextMischiefAt).toBe(6 * HOUR);
    const sweet = first.neighborhood.bots.find((b) => b.character === "sweet")!;
    expect(provokeBot(first.neighborhood, sweet.streetId, 0).bots.find((b) => b.id === sweet.id)!.nextMischiefAt).toBeUndefined();
  });
});
