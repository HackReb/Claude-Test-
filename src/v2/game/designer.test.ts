import { describe, expect, it } from "vitest";
import { SHAPES, SLOTS_BY_TYPE, SLOT_ORDER } from "../config/items";
import { SHOP_TYPES } from "../config/shops";
import { colorsIn, designFromText, patternIn, shapeIn } from "./designer";

describe("Designer: Beschreibung → Design", () => {
  it("liest Farben in Reihenfolge, Muster und Form", () => {
    expect(colorsIn("grün-blau gepunkteter Dino")).toEqual(["#2ec27e", "#1982c4"]);
    expect(patternIn("grün-blau gepunkteter Dino")).toBe("dots");
    expect(shapeIn("grün-blau gepunkteter Dino", "pet")).toBe("dino");
    expect(shapeIn("Abenteurer mit Hut", "hat")).toBe("cowboy");
    expect(shapeIn("Peitsche für Abenteurer", "hand")).toBe("whip");
    expect(shapeIn("irgendwas", "hat")).toBeNull();
  });

  it("gleiche Beschreibung = gleiches Design, Lücken werden fest ausgewürfelt", () => {
    const a = designFromText("Grün-blau gepunkteter Dino", "pet");
    const b = designFromText("grün blau gepunkteter dino!", "pet");
    expect(a).toEqual(b);
    expect(a).toMatchObject({ slot: "pet", shape: "dino", pattern: "dots", colors: ["#2ec27e", "#1982c4", expect.any(String)] });
    const c = designFromText("Irgendwas Verrücktes", "hat");
    expect(SHAPES.hat.some((s) => s.id === c.shape)).toBe(true);
    expect(c.colors).toHaveLength(3);
    expect(designFromText("Irgendwas Verrücktes", "hat")).toEqual(c);
    expect(designFromText("Irgendwas anderes", "hat")).not.toEqual(c);
  });

  it("jeder Ladentyp beliefert bekannte Plätze", () => {
    for (const t of SHOP_TYPES) {
      const slots = SLOTS_BY_TYPE[t.id];
      expect(slots, t.id).toBeDefined();
      for (const slot of slots!) expect(SLOT_ORDER).toContain(slot);
    }
  });
});
