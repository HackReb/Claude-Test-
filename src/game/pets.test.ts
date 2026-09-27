import { describe, expect, it } from "vitest";
import { CAR_OUTINGS, PETS, SPECIES } from "../config/pets";
import type { Street } from "../model/types";
import { buyCar } from "./cars";
import { claimStreet } from "./claimStreet";
import { homeComfort } from "./life";
import { applyMischief, washFacade } from "./mischief";
import { buyPet, dueOutings, petUpkeepPerHour } from "./pets";
import { buyPlot, placeBuilding } from "./plots";
import { simulate } from "./rent";
import { buildingFromTemplate, TEMPLATES } from "./templates";

const HOUR = 3_600_000;
const kalle = () => claimStreet({ playerName: "Kalle", street: { name: "Bahnhofstraße", city: "Tuttlingen" } }, 0);
const neighbor = (name: string) => ({ ...claimStreet({ playerName: name, street: { name: `${name}weg`, city: "Tuttlingen" } }, 0).street, ownerId: `bot-${name}` });

describe("Tierhandlung", () => {
  it("Tier kaufen: kostet, braucht einen Namen, höchstens 5 Tiere, Futter kostet laufend", () => {
    const { player } = kalle();
    const elefant = SPECIES.find((s) => s.id === "elefant")!;
    const bought = buyPet({ ...player, coins: 20_000 }, "elefant", "  Benjamin  ", 0);
    if (!bought.ok) throw new Error(bought.reason);
    expect(bought.pet).toMatchObject({ speciesId: "elefant", name: "Benjamin", nextOutingAt: 16 * HOUR });
    expect(bought.player.coins).toBe(20_000 - elefant.price);
    expect(petUpkeepPerHour(bought.player)).toBe(elefant.upkeepPerHour);
    expect(buyPet(player, "elefant", "Dumbo", 0)).toEqual({ ok: false, reason: "too-expensive" });
    expect(buyPet(player, "katze", "   ", 0)).toEqual({ ok: false, reason: "no-name" });
    const full = { ...bought.player, coins: 1e6, pets: Array.from({ length: PETS.maxPets }, () => bought.pet) };
    expect(buyPet(full, "katze", "Mieze", 0)).toEqual({ ok: false, reason: "full" });
  });

  it("Futterkosten laufen in der Simulation mit", () => {
    const { player, street } = kalle();
    const withCat = buyPet(player, "katze", "Mieze", 0);
    if (!withCat.ok) throw new Error();
    const a = simulate(player, [street], 10 * HOUR);
    const b = simulate(withCat.player, [street], 10 * HOUR);
    expect(b.upkeep - a.upkeep).toBeCloseTo(10 * SPECIES.find((s) => s.id === "katze")!.upkeepPerHour);
  });
});

describe("Ausflüge in die Nachbarschaft", () => {
  it("nach festem Takt: der Elefant macht mehr Haufen als die Katze", () => {
    const { player } = kalle();
    let p = { ...player, coins: 1e6 };
    for (const [sp, name] of [["elefant", "Benjamin"], ["katze", "Mieze"]]) {
      const bought = buyPet(p, sp, name, 0);
      if (!bought.ok) throw new Error();
      p = bought.player;
    }
    const zoe = neighbor("Zoe");
    expect(dueOutings(p, [zoe], 9 * HOUR).outings).toEqual([]); // noch keiner fällig
    const due = dueOutings(p, [zoe], 17 * HOUR);
    expect(due.outings.map((o) => o.mischief.badBoyId).sort()).toEqual(["tier-elefant", "tier-katze"]);
    expect(due.outings.find((o) => o.mischief.badBoyId === "tier-elefant")!.mischief.label).toBe("Kalles Elefant Benjamin");
    expect(dueOutings(due.player, [zoe], 17 * HOUR).outings).toEqual([]); // nicht doppelt

    let street: Street = zoe;
    const counts: Record<string, number> = {};
    for (const outing of due.outings) {
      const before = street.litter?.length ?? 0;
      const applied = applyMischief(street, outing.mischief);
      street = applied.street;
      counts[outing.mischief.badBoyId] = (street.litter?.length ?? 0) - before;
      expect(applied.incident!.senderName).toBe("Kalle");
    }
    expect(counts["tier-elefant"]).toBe(8);
    expect(counts["tier-katze"]).toBe(1);
    expect(street.incidents!.find((i) => i.badBoyId === "tier-elefant")!.text).toBe("Kalles Elefant Benjamin war im Zoeweg spazieren: 8 Haufen. Igitt!");
  });

  it("lange weg: höchstens zwei Ausflüge je Tier werden nachgeholt", () => {
    const bought = buyPet({ ...kalle().player, coins: 1e6 }, "dackel", "Waldi", 0);
    if (!bought.ok) throw new Error();
    expect(dueOutings(bought.player, [neighbor("Zoe")], 30 * 24 * HOUR).outings).toHaveLength(PETS.maxCatchUp);
  });

  it("Autos: Ruß je nach Modell an einer Fassade, Elektro bleibt sauber, Waschen kostet", () => {
    const { player } = kalle();
    let p = { ...player, coins: 1e6 };
    for (const modelId of ["mottenwerke-xprotz", "voltarello-blitz"]) {
      const bought = buyCar(p, { modelId, color: "#e63946", name: modelId, plate: "TUT-KA 1" }, 0);
      if (!bought.ok) throw new Error();
      p = bought.player;
    }
    let zoe: Street = neighbor("Zoe");
    const home = zoe.plots.find((pl) => pl.size === "M" && pl.purchasedAt === undefined)!;
    const bought = buyPlot({ ...p, id: zoe.ownerId, coins: 1e6 }, zoe, home.id, 0);
    if (!bought.ok) throw new Error(bought.reason);
    zoe = placeBuilding(bought.street, home.id, buildingFromTemplate(TEMPLATES.find((t) => t.id === "wohnhaus")!))!;

    const due = dueOutings(p, [zoe], CAR_OUTINGS.everyHours * HOUR);
    expect(due.outings.map((o) => o.mischief.badBoyId)).toEqual(["auto-mottenwerke-xprotz"]);
    const applied = applyMischief(zoe, due.outings[0].mischief);
    const sooty = applied.street.plots.find((pl) => pl.building?.soot)!;
    expect(sooty.building!.soot).toBe(3);
    expect(applied.incident!.text).toContain("durchgebraust – Ruß an");
    expect(homeComfort(applied.street)).toBeLessThan(homeComfort(zoe));

    const washed = washFacade({ ...p, coins: 100 }, applied.street, sooty.id);
    if (!washed.ok) throw new Error();
    expect(washed.player.coins).toBe(100 - CAR_OUTINGS.washCost);
    expect(washed.street.plots.find((pl) => pl.id === sooty.id)!.building!.soot).toBeUndefined();
  });

  it("Wachschutz hält Tiere und Autos nicht auf", () => {
    const zoe = { ...neighbor("Zoe"), security: 2 as const };
    const applied = applyMischief(zoe, { id: "x", badBoyId: "tier-dackel", at: 1, blocked: true, senderName: "Maxim", label: "Maxims Dackel Waldi" });
    expect(applied.incident!.blocked).toBe(false);
    expect(applied.street.litter).toHaveLength(2);
  });
});
