import { describe, expect, it } from "vitest";
import { ECONOMY } from "../config/economy";
import { LIFE } from "../config/life";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { buildPlayground } from "./life";
import { buyPlot, placeBuilding } from "./plots";
import { buildingIncomePerHour, collectRent, playerIncomePerHour, playerUpkeepPerHour, simulate } from "./rent";
import { buildingFromTemplate, TEMPLATES } from "./templates";

const HOUR = 3_600_000;
const tpl = (id: string) => buildingFromTemplate(TEMPLATES.find((t) => t.id === id)!);
const start = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);

/** Kalles Straße mit Kiosk, S-Wohnhaus und Spielplatz – alles voll belegt, feste ID für reproduzierbaren Müll. */
function tidyStreet() {
  let { player, street } = start();
  const buy = (size: "S" | "M") => {
    const plot = street.plots.find((p) => p.size === size && p.purchasedAt === undefined)!;
    const bought = buyPlot({ ...player, coins: 99_999 }, street, plot.id, 0);
    if (!bought.ok) throw new Error(bought.reason);
    street = bought.street;
    return plot.id;
  };
  const homeId = buy("S");
  street = placeBuilding(street, homeId, tpl("wohnhaus"))!;
  const playgroundId = buy("S");
  const playground = buildPlayground({ ...player, coins: 99_999 }, street, playgroundId);
  if (!playground.ok) throw new Error(playground.reason);
  street = playground.street;
  const full: Street = {
    ...street,
    id: "kalles-weg",
    plots: street.plots.map((p) => (p.building ? { ...p, building: { ...p.building, occupancy: 1 } } : p)),
  };
  return { player: { ...player, streetId: full.id }, street: full };
}

describe("Einnahmen & Kosten", () => {
  it("Wohnhaus: Plätze × Miete je Bewohner × Mietniveau der Fassade", () => {
    const home = tpl("wohnhaus");
    const perResident = ECONOMY.rentPerResidentPerHour;
    expect(buildingIncomePerHour("S", home, 1) / (ECONOMY.plotSizes.S.capacity * perResident)).toBeGreaterThanOrEqual(1);
    expect(buildingIncomePerHour("S", home, 0.5)).toBeCloseTo(buildingIncomePerHour("S", home, 1) / 2);
    expect(buildingIncomePerHour("S", { ...home, level: 3 }, 1)).toBeCloseTo(buildingIncomePerHour("S", home, 1) * (Math.round(4 * 2.2) / 4));
  });

  it("Start: Kiosk plus Wohnhaus, voll und sauber – ein paar Hundert Münzen am Tag", () => {
    const { player, street } = tidyStreet();
    const net = playerIncomePerHour([street], player.id) - playerUpkeepPerHour([street], player.id);
    expect(net).toBeGreaterThan(8);
    expect(net * 24).toBeLessThan(600);
  });
});

describe("simulate", () => {
  it("bucht Miete in die Kasse und Kosten vom Konto, Zeit läuft weiter", () => {
    const { player, street } = tidyStreet();
    const { player: after, income, upkeep } = simulate(player, [street], 2 * HOUR);
    expect(income).toBeGreaterThan(0);
    expect(upkeep).toBeCloseTo(2 * playerUpkeepPerHour([street], player.id));
    expect(after.pendingRent).toBeCloseTo(income);
    expect(after.coins).toBeCloseTo(player.coins - upkeep);
    expect(after.lastSeen).toBe(2 * HOUR);
  });

  it("wer sich drei Tage nicht kümmert: Müll, Leute ziehen aus, Kosten fressen das Geld", () => {
    const { player, street } = tidyStreet();
    const day1 = simulate(player, [street], 24 * HOUR);
    const day3 = simulate(player, [street], 72 * HOUR);
    const home = (s: Street) => s.plots.find((p) => p.building?.use === "residential")!.building!.occupancy!;

    expect(day3.streets[0].litter!.length).toBe(LIFE.maxLitter);
    expect(home(day1.streets[0])).toBeLessThan(0.9);
    expect(home(day3.streets[0])).toBeLessThan(0.35);
    expect(day3.movedOut).toBeGreaterThan(2);
    // Am dritten Tag verdient die Straße kaum noch etwas, die Kosten laufen weiter.
    const lastDay = simulate(day1.player, day1.streets, 72 * HOUR);
    const firstDayNet = day1.income - day1.upkeep;
    expect(lastDay.income - lastDay.upkeep).toBeLessThan(firstDayNet * 2);
  });

  it("wer aufräumt, hält die Häuser voll", () => {
    const { player, street } = tidyStreet();
    let state = { player, streets: [street] };
    for (let hour = 1; hour <= 72; hour++) {
      const next = simulate(state.player, state.streets, hour * HOUR);
      state = { player: next.player, streets: next.streets.map((s) => ({ ...s, litter: [] })) }; // stündlich sauber machen
    }
    const home = state.streets[0].plots.find((p) => p.building?.use === "residential")!.building!.occupancy!;
    expect(home).toBe(1);
  });

  it("neue Mieter ziehen nach und nach ein", () => {
    const { player, street } = tidyStreet();
    const empty = { ...street, plots: street.plots.map((p) => (p.building?.use === "residential" ? { ...p, building: { ...p.building, occupancy: 0 } } : p)) };
    const { streets, movedIn } = simulate(player, [empty], 5 * HOUR);
    const home = streets[0].plots.find((p) => p.building?.use === "residential")!.building!.occupancy!;
    expect(home).toBeCloseTo(5 * LIFE.moveInPerHour, 1);
    expect(movedIn).toBeGreaterThan(0);
  });

  it("fremde Grundstücke in der eigenen Straße und fremde Straßen bleiben unangetastet", () => {
    const { player, street } = tidyStreet();
    const foreignPlot = street.plots.find((p) => p.purchasedAt === undefined && p.size === "M")!;
    const withZoe: Street = {
      ...street,
      plots: street.plots.map((p) => (p.id === foreignPlot.id ? { ...p, purchasedAt: 0, ownerId: "zoe", building: { ...tpl("wohnhaus"), occupancy: 0.4 } } : p)),
    };
    const { streets, upkeep } = simulate(player, [withZoe], 10 * HOUR);
    expect(streets[0].plots.find((p) => p.id === foreignPlot.id)!.building!.occupancy).toBe(0.4);
    expect(upkeep).toBeCloseTo(10 * playerUpkeepPerHour([street], player.id));
  });

  it("ignoriert Uhren, die zurückspringen, und pausiert nach langer Abwesenheit", () => {
    const { player, street } = tidyStreet();
    const back = simulate({ ...player, lastSeen: 5 * HOUR }, [street], HOUR);
    expect(back.income).toBe(0);
    expect(back.player.lastSeen).toBe(5 * HOUR);
    const year = simulate(player, [street], 365 * 24 * HOUR);
    const twoWeeks = simulate(player, [street], ECONOMY.maxOfflineHours * HOUR);
    expect(year.upkeep).toBeCloseTo(twoWeeks.upkeep);
  });

  it("Einsammeln überträgt ganze Münzen, Bruchteile bleiben", () => {
    const { player } = start();
    const { player: after, collected } = collectRent({ ...player, pendingRent: 42.7 });
    expect(collected).toBe(42);
    expect(after.coins).toBe(player.coins + 42);
    expect(after.pendingRent).toBeCloseTo(0.7);
  });
});
