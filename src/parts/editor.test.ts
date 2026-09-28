import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../game/templates";
import type { Facade } from "../model/types";
import { partAt, placePart, removeAt, setFloors, setText, starterFacade } from "./editor";
import { validateFacade } from "./rules";

const ok = (result: ReturnType<typeof placePart>): Facade => {
  if (!result.ok) throw new Error(result.reason);
  return result.facade;
};

describe("Baukasten", () => {
  it("Start-Fassade ist gültig", () => {
    expect(validateFacade(starterFacade(), "S")).toEqual([]);
  });

  it("setzt Teile, ersetzt auf gleicher Ebene und legt Schilder über Fenster", () => {
    let f = starterFacade();
    f = ok(placePart(f, "S", "window-round", 1, 0)); // ersetzt das Sprossenfenster
    expect(f.parts.filter((p) => p.x === 1 && p.y === 0).map((p) => p.partId)).toEqual(["window-round"]);
    f = ok(placePart(f, "S", "deco-sign", 1, 0)); // eigene Ebene: bleibt neben dem Fenster
    expect(f.parts).toHaveLength(3);
    expect(partAt(f, 1, 0)?.partId).toBe("deco-sign");
    expect(partAt(f, 1, 0)?.text).toBe("BABO");
    expect(validateFacade(f, "S")).toEqual([]);
  });

  it("verweigert falsche Reihen und zu viele Teile", () => {
    const f = setFloors(starterFacade(), "M", 2);
    expect(placePart(f, "M", "door-shop", 0, 1)).toEqual({ ok: false, reason: "Ladentür gehört ins Erdgeschoss." });
    expect(placePart(f, "M", "deco-flag", 0, 0)).toEqual({ ok: false, reason: "Flagge gehört aufs Dach." });
    let g = setFloors(starterFacade(), "L", 3);
    const spots = [[2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]];
    for (const [x, y] of spots) g = ok(placePart(g, "L", "window-square", x, y));
    expect(placePart(g, "L", "window-square", 1, 2)).toEqual({ ok: false, reason: "Höchstens 8 Fenster." });
    // ersetzen geht auch am Limit
    expect(placePart(g, "L", "window-round", 1, 1).ok).toBe(true);
  });

  it("entfernt das oberste Teil zuerst", () => {
    let f = ok(placePart(starterFacade(), "S", "deco-sign", 0, 0));
    f = removeAt(f, 0, 0);
    expect(partAt(f, 0, 0)?.partId).toBe("door-shop");
    f = removeAt(f, 0, 0);
    expect(partAt(f, 0, 0)).toBeUndefined();
    expect(validateFacade(f, "S")).toContain("Mindestens eine Tür nötig.");
  });

  it("Schild-Text wird groß geschrieben und gekürzt", () => {
    const f = setText(ok(placePart(starterFacade(), "S", "deco-sign", 0, 0)), 0, 0, "dönerbude tuttlingen");
    expect(partAt(f, 0, 0)?.text).toBe("DÖNERBUDE ");
  });

  it("Stockwerke: Dach-Deko wandert mit, wegfallende Teile verschwinden, Grenzen je Größe", () => {
    const castle = TEMPLATES.find((t) => t.id === "gummibaerchenschloss")!.facade;
    const lower = setFloors(castle, "L", 1);
    expect(lower.floors).toBe(1);
    expect(lower.parts.every((p) => p.y === 0 || p.partId === "deco-flag")).toBe(true);
    expect(lower.parts.filter((p) => p.partId === "deco-flag").every((p) => p.y === 1)).toBe(true);
    // Die Fenster im Erdgeschoss bleiben, die oberen fallen weg.
    expect(lower.parts.filter((p) => p.partId.startsWith("window")).map((p) => p.y)).toEqual([0, 0]);
    expect(validateFacade(lower, "L")).toEqual([]);
    const topOnly = { ...castle, parts: castle.parts.filter((p) => !(p.partId.startsWith("window") && p.y === 0)) };
    expect(validateFacade(setFloors(topOnly, "L", 1), "L")).toEqual(["1–8 Fenster erlaubt."]);
    expect(setFloors(starterFacade(), "S", 3).floors).toBe(1);
    expect(setFloors(starterFacade(), "M", 5).floors).toBe(2);
  });
});
