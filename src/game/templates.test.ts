import { describe, expect, it } from "vitest";
import { validateFacade } from "../parts/rules";
import { TEMPLATES, templatesFor } from "./templates";

describe("Vorlagen", () => {
  it("alle Vorlagen sind gültige Fassaden", () => {
    for (const t of TEMPLATES) expect(validateFacade(t.facade, t.size), t.id).toEqual([]);
  });

  it("jede Größe hat Wohnhäuser und Läden – Bewohner brauchen beides", () => {
    for (const size of ["S", "M", "L"] as const) {
      const uses = new Set(templatesFor(size).map((t) => t.use));
      expect(uses, size).toEqual(new Set(["residential", "commercial"]));
    }
  });
});
