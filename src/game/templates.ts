import type { Building, BuildingUse, Facade, PlacedPart, PlotSize } from "../model/types";
import { createId } from "./ids";
import { personalName } from "./names";

export interface Template {
  id: string;
  name: string;
  size: PlotSize;
  /** Vorschlag für die Nutzung – beim Bauen änderbar. */
  use: BuildingUse;
  facade: Facade;
}

const at = (partId: string, x: number, y: number, text?: string): PlacedPart =>
  text === undefined ? { partId, x, y } : { partId, x, y, text };

/** Vorlagen-Bibliothek (Konzept 6.1) – gefiltert nach Grundstücksgröße. */
export const TEMPLATES: Template[] = [
  // ---------- S: 2 Spalten, 1 Stockwerk ----------
  {
    id: "kiosk",
    name: "Kiosk",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [at("door-shop", 0, 0), at("window-square", 1, 0), at("deco-sign", 0, 0, "KIOSK")],
    },
  },
  {
    id: "imbiss",
    name: "Imbiss",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-pitched" },
      floors: 1,
      parts: [at("door-shop", 1, 0), at("window-square", 0, 0), at("deco-sign", 0, 0, "IMBISS"), at("deco-antenna", 1, 1)],
    },
  },
  {
    id: "friseur",
    name: "Friseur",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-ice" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [at("door-glass", 0, 0), at("window-round", 1, 0), at("deco-neon", 1, 0, "HAARE")],
    },
  },
  {
    id: "huepfburg",
    name: "Hüpfburg",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-gummy" },
      roof: { partId: "roof-battlements" },
      floors: 1,
      parts: [at("door-arch", 0, 0), at("window-round", 1, 0), at("deco-flag", 0, 1), at("deco-flag", 1, 1)],
    },
  },

  // ---------- M: 4 Spalten, bis 2 Stockwerke ----------
  {
    id: "baeckerei",
    name: "Bäckerei",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-pitched" },
      floors: 2,
      parts: [
        at("door-shop", 1, 0),
        at("window-square", 2, 0),
        at("window-arch", 0, 1),
        at("window-arch", 3, 1),
        at("deco-sign", 1, 0, "BÄCKER"),
      ],
    },
  },
  {
    id: "wohnhaus",
    name: "Wohnhaus",
    size: "M",
    use: "residential",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-pitched" },
      floors: 2,
      parts: [
        at("door-arch", 1, 0),
        at("window-square", 3, 0),
        at("window-square", 0, 1),
        at("window-square", 2, 1),
        at("deco-palm", 0, 0),
        at("deco-antenna", 3, 2),
      ],
    },
  },
  {
    id: "doenerbude",
    name: "Dönerbude",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        at("door-glass", 1, 0),
        at("window-square", 2, 0),
        at("window-square", 3, 0),
        at("deco-neon", 2, 0, "DÖNER"),
        at("deco-neon", 3, 0, "24/7"),
        at("deco-antenna", 0, 1),
      ],
    },
  },
  {
    id: "eisdiele",
    name: "Eisdiele",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-ice" },
      roof: { partId: "roof-icing" },
      floors: 1,
      parts: [
        at("door-glass", 2, 0),
        at("window-round", 1, 0),
        at("deco-fence", 0, 0),
        at("deco-fence", 3, 0),
        at("deco-sign", 1, 0, "EIS"),
      ],
    },
  },

  // ---------- L: 6 Spalten, bis 3 Stockwerke ----------
  {
    id: "gummibaerchenschloss",
    name: "Gummibärchenschloss",
    size: "L",
    use: "residential",
    facade: {
      base: { partId: "base-gummy" },
      roof: { partId: "roof-battlements" },
      floors: 3,
      parts: [
        at("door-arch", 2, 0),
        at("door-arch", 3, 0),
        at("window-arch", 1, 1),
        at("window-arch", 4, 1),
        at("window-round", 2, 2),
        at("window-round", 3, 2),
        at("deco-flag", 0, 3),
        at("deco-flag", 5, 3),
        at("deco-sign", 2, 1, "SCHLOSS"),
      ],
    },
  },
  {
    id: "freizeitpark",
    name: "Freizeitpark",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-dome" },
      floors: 2,
      parts: [
        at("door-glass", 2, 0),
        at("door-glass", 3, 0),
        at("window-round", 1, 1),
        at("window-round", 4, 1),
        at("deco-palm", 0, 0),
        at("deco-palm", 5, 0),
        at("deco-neon", 2, 1, "FUN"),
      ],
    },
  },
  {
    id: "schwimmbad",
    name: "Schwimmbad",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-ice" },
      roof: { partId: "roof-flat" },
      floors: 2,
      parts: [
        at("door-glass", 3, 0),
        at("window-round", 0, 1),
        at("window-round", 2, 1),
        at("window-round", 4, 1),
        at("deco-palm", 1, 0),
        at("deco-palm", 5, 0),
        at("deco-sign", 3, 1, "BAD"),
      ],
    },
  },
  {
    id: "klaeranlage",
    name: "Kläranlage",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        at("door-shop", 1, 0),
        at("window-round", 2, 0),
        at("window-round", 3, 0),
        at("window-round", 4, 0),
        at("deco-antenna", 5, 1),
        at("deco-sign", 2, 0, "KLÄRWERK"),
      ],
    },
  },
  {
    id: "schokofabrik",
    name: "Schokofabrik",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-chocolate" },
      roof: { partId: "roof-icing" },
      floors: 3,
      parts: [
        at("door-arch", 3, 0),
        at("window-square", 1, 1),
        at("window-square", 4, 1),
        at("window-arch", 2, 2),
        at("deco-fountain", 1, 0),
        at("deco-fountain", 5, 0),
        at("deco-sign", 3, 1, "SCHOKO"),
      ],
    },
  },
];

export function templatesFor(size: PlotSize): Template[] {
  return TEMPLATES.filter((t) => t.size === size);
}

export function buildingFromTemplate(template: Template): Building {
  return {
    id: createId(),
    name: template.name,
    level: 1,
    createdBy: "template",
    use: template.use,
    facade: structuredClone(template.facade),
  };
}

/** Start-Gebäude auf dem geschenkten Grundstück, damit von Anfang an Miete fließt – z. B. „Kalles Kiosk“. */
export function starterKiosk(ownerName?: string): Building {
  const building = buildingFromTemplate(TEMPLATES[0]);
  return ownerName ? { ...building, name: personalName(ownerName, building.name) } : building;
}
