import { describe, expect, it } from "vitest";
import { getPart } from "../parts/catalog";
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

  it("Wohnhäuser sehen nach Wohnen aus, Läden nach Laden", () => {
    for (const t of TEMPLATES) {
      const uses = t.facade.parts.map((p) => getPart(p.partId)?.use).filter(Boolean);
      if (t.use === "commercial") expect(uses, t.id).toContain("commercial");
      // Nur das Schloss-Schild darf bei Wohnhäusern sein – keine Ladentüren oder Schaufenster.
      else expect(t.facade.parts.filter((p) => getPart(p.partId)?.use === "commercial" && p.partId !== "deco-sign"), t.id).toEqual([]);
    }
  });

  it("genug Auswahl: je Größe mehrere Wohnhäuser und Läden", () => {
    for (const size of ["S", "M", "L"] as const) {
      expect(templatesFor(size, "residential").length, size).toBeGreaterThanOrEqual(3);
      expect(templatesFor(size, "commercial").length, size).toBeGreaterThanOrEqual(4);
    }
  });
});
