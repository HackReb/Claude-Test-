import { describe, expect, it } from "vitest";
import type { Street } from "../model/types";
import { claimStreet } from "./claimStreet";
import { addLitter } from "./life";
import { makeIssue, paperDay, paperStats, type PaperStreet } from "./newspaper";
import { buyPlot, placeBuilding } from "./plots";
import { buildingFromTemplate, TEMPLATES } from "./templates";

const tpl = (id: string) => buildingFromTemplate(TEMPLATES.find((t) => t.id === id)!);
const DAY = 24 * 3_600_000;

function kallesStreet() {
  const s = claimStreet({ playerName: "Kalle", street: { name: "Bahnhofstraße", city: "Tuttlingen" } }, 0);
  const plot = s.street.plots.find((p) => p.size === "M" && p.purchasedAt === undefined)!;
  const bought = buyPlot({ ...s.player, coins: 1e6 }, s.street, plot.id, 0);
  if (!bought.ok) throw new Error();
  const street = placeBuilding(bought.street, plot.id, tpl("wohnhaus"))!;
  return { player: s.player, street, homeId: plot.id };
}

const own = (street: Street): PaperStreet => ({ street, ownerName: "Kalle", own: true });
const withOccupancy = (street: Street, occupancy: number): Street => ({
  ...street,
  plots: street.plots.map((p) => (p.building ? { ...p, building: { ...p.building, occupancy } } : p)),
});

describe("Babo-Anzeiger", () => {
  it("Hundekacke-Alarm mit Straßennamen", () => {
    let { street } = kallesStreet();
    for (let i = 0; i < 7; i++) street = addLitter(street, "poop", { pos: 0.3, side: "top" });
    const issue = makeIssue({ streets: [own(street)], previous: {}, news: [], coins: 100, now: 5 });
    expect(issue.stories[0].tone).toBe("bad");
    expect(issue.stories[0].text).toContain("7 Hundehaufen");
    expect(["Bahnhofstraße versinkt in Hundekacke – Igitt!", "Tretminen-Alarm in der Bahnhofstraße!", "Bahnhofstraße: Wer räumt das endlich weg?"]).toContain(
      issue.stories[0].headline,
    );
  });

  it("vergleicht mit gestern: Massenflucht und Rekordumsätze beim Kiosk", () => {
    const { street } = kallesStreet();
    const yesterday = { [street.id]: paperStats(withOccupancy(street, 0.9)) };
    const exodus = makeIssue({ streets: [own(withOccupancy(street, 0.3))], previous: yesterday, news: [], coins: 100, now: DAY });
    expect(exodus.stories.map((s) => s.id)).toContain(`${street.id}-exodus`);

    const lastWeek = { [street.id]: paperStats(withOccupancy(street, 0.2)) };
    const boom = makeIssue({ streets: [own(withOccupancy(street, 1))], previous: lastWeek, news: [], coins: 100, now: DAY });
    const story = boom.stories.find((s) => s.id === `${street.id}-boom`)!;
    expect(story.headline).toContain("Kalles Kiosk");
  });

  it("berichtet über Nachbarn, Bad Boys und erwischte Auftraggeber", () => {
    const { street } = kallesStreet();
    const zoe = { ...claimStreet({ playerName: "Zoe", street: { name: "Zuckerallee", city: "Tuttlingen" } }, 0).street, ownerId: "bot-zoe" };
    const issue = makeIssue({
      streets: [own(street), { street: zoe, ownerName: "Zucker-Zoe", own: false }],
      previous: {},
      news: [
        { streetId: street.id, at: 3, text: "Nachbarschaftswache hat Sprühdosen-Kevin erwischt – geschickt von Maxim!", emoji: "🛡️" },
        { botId: "bot-zoe", streetId: zoe.id, at: 4, text: "Zucker-Zoe hat ein S-Grundstück gekauft und „Zoes Eisdiele“ gebaut." },
      ],
      coins: 100,
      now: 5,
    });
    const texts = issue.stories.map((s) => s.text);
    expect(texts).toContain("Nachbarschaftswache hat Sprühdosen-Kevin erwischt – geschickt von Maxim!");
    expect(texts.some((t) => t.includes("Zoes Eisdiele"))).toBe(true);
  });

  it("Minus auf dem Konto schafft es auf die Titelseite; sonst ein ruhiger Tag", () => {
    const { street } = kallesStreet();
    const clean = withOccupancy(street, 0.5);
    const broke = makeIssue({ streets: [own(clean)], previous: {}, news: [], coins: -250, now: 5 });
    expect(broke.stories[0].text).toContain("-250");
    const quietStreet = claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0).street;
    const quiet = makeIssue({ streets: [own(quietStreet)], previous: {}, news: [], coins: 5, now: 5 });
    expect(quiet.stories).toHaveLength(1);
  });

  it("gleicher Tag → gleiche Zeitung", () => {
    let { street } = kallesStreet();
    for (let i = 0; i < 7; i++) street = addLitter(street, "trash", { pos: 0.3, side: "top" });
    const input = { streets: [own(street)], previous: {}, news: [], coins: 5, now: 10 };
    expect(makeIssue(input)).toEqual(makeIssue(input));
    expect(paperDay(new Date(2026, 8, 27, 23, 59).getTime())).toBe("2026-09-27");
  });
});
