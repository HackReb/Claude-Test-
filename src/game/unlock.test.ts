import { describe, expect, it } from "vitest";
import { isUnlocked, getPart, PARTS } from "../parts/catalog";
import { validateFacade } from "../parts/rules";
import { claimStreet } from "./claimStreet";
import { seededRandom } from "./random";
import { randomFacade } from "./randomBuilding";
import { unlockPart } from "./unlock";

const player = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0).player;

describe("Bausteine freischalten", () => {
  it("kostet Münzen und geht nur einmal", () => {
    const result = unlockPart(player(), "base-chocolate");
    if (!result.ok) throw new Error(result.reason);
    expect(result.player.coins).toBe(1000 - 800);
    expect(isUnlocked(getPart("base-chocolate")!, result.player.unlockedParts)).toBe(true);
    expect(unlockPart(result.player, "base-chocolate")).toEqual({ ok: false, reason: "already" });
    expect(unlockPart(player(), "base-gummy")).toEqual({ ok: false, reason: "too-expensive" });
    expect(unlockPart(player(), "roof-flat")).toEqual({ ok: false, reason: "already" });
  });

  it("Würfeln mit Start-Set nutzt nur freie Teile und bleibt gültig", () => {
    const random = seededRandom(11);
    const free = (id: string) => getPart(id)!.price === 0;
    for (let i = 0; i < 1000; i++) {
      for (const size of ["S", "M", "L"] as const) {
        const f = randomFacade(size, random, (p) => p.price === 0);
        expect(validateFacade(f, size)).toEqual([]);
        expect([f.base, f.roof, ...f.parts].every((p) => free(p.partId))).toBe(true);
      }
    }
    // Start-Set deckt alle Pflicht-Kategorien ab
    for (const category of ["base", "roof", "door", "window"] as const) {
      expect(PARTS.some((p) => p.category === category && p.price === 0)).toBe(true);
    }
  });
});
