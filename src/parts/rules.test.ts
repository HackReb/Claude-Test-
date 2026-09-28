import { describe, expect, it } from "vitest";
import { seededRandom } from "../game/random";
import { randomBuilding, randomFacade } from "../game/randomBuilding";
import { TEMPLATES, templatesFor } from "../game/templates";
import { getPart, PARTS, partsOf } from "./catalog";
import { validateFacade } from "./rules";

describe("Teile-Katalog", () => {
  it("hat das Start-Set aus dem Konzept (≈5/4/3/3/6)", () => {
    expect(partsOf("base").length).toBeGreaterThanOrEqual(5);
    expect(partsOf("roof").length).toBeGreaterThanOrEqual(4);
    expect(partsOf("door").length).toBeGreaterThanOrEqual(3);
    expect(partsOf("window").length).toBeGreaterThanOrEqual(3);
    expect(partsOf("deco").length).toBeGreaterThanOrEqual(6);
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
  });
});

describe("Vorlagen", () => {
  it("mindestens 3 je Größe", () => {
    for (const size of ["S", "M", "L"] as const) expect(templatesFor(size).length).toBeGreaterThanOrEqual(3);
  });

  it.each(TEMPLATES.map((t) => [t.name, t] as const))("%s ist gültig", (_, template) => {
    expect(validateFacade(template.facade, template.size)).toEqual([]);
  });

  it("enthält das Gummibärchenschloss", () => {
    const castle = TEMPLATES.find((t) => t.name === "Gummibärchenschloss");
    expect(castle?.size).toBe("L");
    expect(castle?.facade.base.partId).toBe("base-gummy");
  });
});

describe("Zufallsgenerator", () => {
  it.each(["S", "M", "L"] as const)("erzeugt für %s nur gültige Fassaden", (size) => {
    const random = seededRandom(42);
    for (let i = 0; i < 3000; i++) {
      const facade = randomFacade(size, random);
      const errors = validateFacade(facade, size);
      if (errors.length) throw new Error(`Wurf ${i}: ${errors.join(", ")}\n${JSON.stringify(facade)}`);
    }
  });

  it("nutzt die Vielfalt: alle Grundkörper, Dächer und Deko-Teile kommen vor", () => {
    const random = seededRandom(7);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const f = randomFacade("L", random);
      [f.base, f.roof, ...f.parts].forEach((p) => seen.add(p.partId));
    }
    expect([...seen].sort()).toEqual(PARTS.map((p) => p.id).sort());
  });

  it("Würfeln nach Nutzung: Wohnhaus ohne Ladenteile, Laden mit Schild und Schaufenster", () => {
    const random = seededRandom(5);
    for (let i = 0; i < 300; i++) {
      for (const size of ["S", "M", "L"] as const) {
        const home = randomBuilding(size, random, { use: "residential" });
        expect(home.use).toBe("residential");
        expect(home.facade.parts.some((p) => getPart(p.partId)?.use === "commercial")).toBe(false);
        const shop = randomBuilding(size, random, { use: "commercial" });
        expect(validateFacade(shop.facade, size)).toEqual([]);
        expect(shop.facade.parts.some((p) => getPart(p.partId)?.textFill && p.text)).toBe(true);
        expect(shop.facade.parts.some((p) => p.y === 0 && getPart(p.partId)?.category === "window" && getPart(p.partId)?.use === "commercial")).toBe(true);
      }
    }
  });

  it("Schilder bekommen Text", () => {
    const random = seededRandom(3);
    for (let i = 0; i < 300; i++) {
      for (const placed of randomFacade("M", random).parts) {
        if (getPart(placed.partId)?.textFill) expect(placed.text).toBeTruthy();
      }
    }
  });
});

describe("validateFacade erkennt Verstöße", () => {
  const ok = TEMPLATES.find((t) => t.id === "kiosk")!;
  it("ohne Tür", () => {
    const facade = { ...ok.facade, parts: ok.facade.parts.filter((p) => !p.partId.startsWith("door")) };
    expect(validateFacade(facade, "S")).toContain("Mindestens eine Tür nötig.");
  });
  it("zu viele Stockwerke / doppelt belegt / Tür im 1. Stock", () => {
    expect(validateFacade({ ...ok.facade, floors: 2 }, "S").length).toBeGreaterThan(0);
    expect(validateFacade({ ...ok.facade, parts: [...ok.facade.parts, { partId: "window-round", x: 1, y: 0 }] }, "S")).toContain(
      "Bullauge: Platz schon belegt.",
    );
    const upstairsDoor = { ...ok.facade, floors: 2 as const, parts: [{ partId: "door-shop", x: 0, y: 1 }, { partId: "window-round", x: 0, y: 0 }] };
    expect(validateFacade(upstairsDoor, "M")).toContain("Ladentür: passt nicht in Reihe 1.");
  });
});
