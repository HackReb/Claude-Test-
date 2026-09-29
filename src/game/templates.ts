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

/** Vorlagen-Bibliothek (Konzept 6.1) – gefiltert nach Grundstücksgröße und Nutzung. */
export const TEMPLATES: Template[] = [
  // ---------- S: 2 Spalten, 1 Stockwerk ----------
  // Gewerbe (der Kiosk bleibt vorne: Start-Gebäude). Der Name steht automatisch auf dem Ladenschild.
  {
    id: "kiosk",
    name: "Kiosk",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-metal" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("door-shop", 0, 0),
        at("window-shop", 1, 0),
        at("deco-awning", 1, 0),
        at("deco-neon", 0, 0, "24/7"),
      ],
    },
  },
  {
    id: "doenerimbiss",
    name: "Döner-Imbiss",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-tiles" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("window-doner", 0, 0),
        at("door-shop", 1, 0),
        at("deco-awning", 0, 0),
        at("deco-neon", 1, 0, "OPEN"),
      ],
    },
  },
  {
    id: "imbiss",
    name: "Imbiss",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-tiles" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        at("window-shop", 0, 0),
        at("door-shop", 1, 0),
        at("deco-awning", 0, 0),
        at("deco-antenna", 1, 1),
      ],
    },
  },
  {
    id: "optiker",
    name: "Optiker",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("door-glass", 0, 0),
        at("window-optician", 1, 0),
        at("deco-awning", 1, 0),
      ],
    },
  },
  {
    id: "eisbude",
    name: "Eisbude",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-ice" },
      roof: { partId: "roof-icing" },
      floors: 1,
      parts: [
        at("door-shop", 0, 0),
        at("window-icecream", 1, 0),
        at("deco-awning", 0, 0),
      ],
    },
  },
  {
    id: "friseur",
    name: "Friseur",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("door-glass", 0, 0),
        at("window-shop", 1, 0),
        at("deco-awning", 0, 0),
        at("deco-neon", 1, 0, "HAARE"),
      ],
    },
  },
  {
    id: "blumenladen",
    name: "Blumenladen",
    size: "S",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        at("window-shop", 0, 0),
        at("door-shop", 1, 0),
        at("deco-awning", 1, 0),
        at("deco-flowerbox", 0, 0),
      ],
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
      parts: [
        at("door-arch", 0, 0),
        at("window-round", 1, 0),
        at("deco-sign", 0, 0, "HÜPF!"),
        at("deco-flag", 0, 1),
        at("deco-flag", 1, 1),
      ],
    },
  },
  // Wohnen
  {
    id: "haeuschen",
    name: "Häuschen",
    size: "S",
    use: "residential",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-pitched" },
      floors: 1,
      parts: [
        at("door-house", 0, 0),
        at("window-square", 1, 0),
        at("deco-flowerbox", 1, 0),
        at("deco-antenna", 0, 1),
      ],
    },
  },
  {
    id: "tinyhouse",
    name: "Tiny House",
    size: "S",
    use: "residential",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        at("door-arch", 0, 0),
        at("window-round", 1, 0),
        at("deco-flag", 1, 1),
      ],
    },
  },
  {
    id: "gartenhaus",
    name: "Gartenhäuschen",
    size: "S",
    use: "residential",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-chimney" },
      floors: 1,
      parts: [
        at("window-arch", 0, 0),
        at("door-house", 1, 0),
        at("deco-flowerbox", 0, 0),
      ],
    },
  },
  {
    id: "hexenhaus",
    name: "Hexenhäuschen",
    size: "S",
    use: "residential",
    facade: {
      base: { partId: "base-chocolate" },
      roof: { partId: "roof-icing" },
      floors: 1,
      parts: [
        at("door-arch", 0, 0),
        at("window-arch", 1, 0),
        at("deco-flowerbox", 1, 0),
      ],
    },
  },

  // ---------- M: 4 Spalten, bis 2 Stockwerke ----------
  // Gewerbe
  {
    id: "baeckerei",
    name: "Bäckerei",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-tiles" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("window-shop", 0, 0),
        at("door-shop", 1, 0),
        at("window-shop", 2, 0),
        at("deco-tree", 3, 0),
        at("deco-awning", 0, 0),
        at("deco-awning", 2, 0),
      ],
    },
  },
  {
    id: "supermarkt",
    name: "Supermarkt",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("window-shop", 0, 0),
        at("door-glass", 1, 0),
        at("window-shop", 2, 0),
        at("window-shop", 3, 0),
        at("deco-awning", 0, 0),
        at("deco-awning", 3, 0),
        at("deco-neon", 2, 0, "SALE"),
      ],
    },
  },
  {
    id: "doenerbude",
    name: "Dönerbude",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-tiles" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("window-doner", 0, 0),
        at("door-glass", 1, 0),
        at("window-shop", 2, 0),
        at("window-doner", 3, 0),
        at("deco-awning", 0, 0),
        at("deco-neon", 2, 0, "24/7"),
        at("deco-awning", 3, 0),
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
        at("deco-fence", 0, 0),
        at("window-icecream", 1, 0),
        at("door-glass", 2, 0),
        at("window-icecream", 3, 0),
        at("deco-awning", 1, 0),
        at("deco-awning", 3, 0),
      ],
    },
  },
  {
    id: "pizzeria",
    name: "Pizzeria",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-shopfront" },
      floors: 2,
      parts: [
        at("window-shop", 0, 0),
        at("door-shop", 1, 0),
        at("window-shop", 2, 0),
        at("deco-palm", 3, 0),
        at("window-arch", 1, 1),
        at("window-arch", 2, 1),
        at("deco-awning", 0, 0),
        at("deco-awning", 2, 0),
      ],
    },
  },
  {
    id: "waschsalon",
    name: "Waschsalon",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-shopfront" },
      floors: 1,
      parts: [
        at("door-glass", 0, 0),
        at("window-round", 1, 0),
        at("window-round", 2, 0),
        at("window-round", 3, 0),
        at("deco-neon", 2, 0, "24/7"),
        at("deco-antenna", 3, 1),
      ],
    },
  },
  {
    id: "tattoostudio",
    name: "Tattoo-Studio",
    size: "M",
    use: "commercial",
    facade: {
      base: { partId: "base-metal" },
      roof: { partId: "roof-flat" },
      floors: 2,
      parts: [
        at("door-glass", 0, 0),
        at("window-shop", 1, 0),
        at("window-shop", 3, 0),
        at("window-round", 1, 1),
        at("window-round", 2, 1),
        at("deco-neon", 1, 0, "INK"),
        at("deco-neon", 3, 0, "OPEN"),
        at("deco-flag", 3, 2),
      ],
    },
  },
  // Wohnen
  {
    id: "wohnhaus",
    name: "Wohnhaus",
    size: "M",
    use: "residential",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-chimney" },
      floors: 2,
      parts: [
        at("window-square", 0, 0),
        at("door-house", 1, 0),
        at("window-square", 2, 0),
        at("deco-tree", 3, 0),
        at("window-square", 0, 1),
        at("window-balcony", 1, 1),
        at("window-balcony", 2, 1),
        at("window-square", 3, 1),
        at("deco-flowerbox", 2, 0),
        at("deco-antenna", 0, 2),
      ],
    },
  },
  {
    id: "reihenhaus",
    name: "Reihenhaus",
    size: "M",
    use: "residential",
    facade: {
      base: { partId: "base-wood" },
      roof: { partId: "roof-pitched" },
      floors: 2,
      parts: [
        at("door-arch", 0, 0),
        at("window-square", 1, 0),
        at("window-square", 2, 0),
        at("door-house", 3, 0),
        at("window-round", 0, 1),
        at("window-arch", 1, 1),
        at("window-arch", 2, 1),
        at("window-round", 3, 1),
        at("deco-flowerbox", 1, 0),
        at("deco-flowerbox", 2, 0),
        at("deco-flag", 1, 2),
      ],
    },
  },
  {
    id: "stadtvilla",
    name: "Stadtvilla",
    size: "M",
    use: "residential",
    facade: {
      base: { partId: "base-ice" },
      roof: { partId: "roof-dome" },
      floors: 2,
      parts: [
        at("window-arch", 0, 0),
        at("door-arch", 1, 0),
        at("window-arch", 2, 0),
        at("deco-palm", 3, 0),
        at("window-balcony", 0, 1),
        at("window-arch", 1, 1),
        at("window-arch", 2, 1),
        at("window-balcony", 3, 1),
        at("deco-flowerbox", 2, 0),
        at("deco-flag", 1, 2),
      ],
    },
  },
  {
    id: "zuckervilla",
    name: "Zuckerbäckervilla",
    size: "M",
    use: "residential",
    facade: {
      base: { partId: "base-chocolate" },
      roof: { partId: "roof-icing" },
      floors: 2,
      parts: [
        at("window-arch", 0, 0),
        at("window-arch", 1, 0),
        at("door-arch", 2, 0),
        at("deco-fence", 3, 0),
        at("window-round", 0, 1),
        at("window-balcony", 1, 1),
        at("window-balcony", 2, 1),
        at("window-round", 3, 1),
        at("deco-flowerbox", 0, 0),
      ],
    },
  },

  // ---------- L: 6 Spalten, bis 3 Stockwerke ----------
  // Wohnen
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
        at("window-arch", 0, 0),
        at("door-arch", 2, 0),
        at("door-arch", 3, 0),
        at("window-arch", 5, 0),
        at("window-arch", 1, 1),
        at("window-arch", 4, 1),
        at("window-round", 2, 2),
        at("window-round", 3, 2),
        at("deco-flag", 0, 3),
        at("deco-flag", 5, 3),
        at("deco-flowerbox", 2, 1),
      ],
    },
  },
  {
    id: "wohnblock",
    name: "Wohnblock",
    size: "L",
    use: "residential",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-flat" },
      floors: 3,
      parts: [
        at("deco-tree", 0, 0),
        at("window-square", 1, 0),
        at("door-house", 3, 0),
        at("window-square", 4, 0),
        at("deco-fountain", 5, 0),
        at("window-balcony", 1, 1),
        at("window-square", 2, 1),
        at("window-square", 3, 1),
        at("window-balcony", 4, 1),
        at("window-balcony", 1, 2),
        at("window-balcony", 4, 2),
        at("deco-antenna", 2, 3),
      ],
    },
  },
  {
    id: "altbau",
    name: "Altbau",
    size: "L",
    use: "residential",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-chimney" },
      floors: 3,
      parts: [
        at("window-square", 0, 0),
        at("door-arch", 3, 0),
        at("window-square", 5, 0),
        at("deco-tree", 1, 0),
        at("window-balcony", 0, 1),
        at("window-arch", 2, 1),
        at("window-arch", 3, 1),
        at("window-balcony", 5, 1),
        at("window-round", 2, 2),
        at("window-round", 3, 2),
        at("deco-flowerbox", 2, 1),
        at("deco-flowerbox", 3, 1),
      ],
    },
  },
  {
    id: "villakunterbunt",
    name: "Villa Kunterbunt",
    size: "L",
    use: "residential",
    facade: {
      base: { partId: "base-gummy" },
      roof: { partId: "roof-pitched" },
      floors: 2,
      parts: [
        at("window-round", 0, 0),
        at("door-house", 1, 0),
        at("window-arch", 2, 0),
        at("deco-palm", 3, 0),
        at("window-square", 4, 0),
        at("deco-fence", 5, 0),
        at("window-balcony", 0, 1),
        at("window-round", 2, 1),
        at("window-balcony", 3, 1),
        at("window-arch", 5, 1),
        at("deco-flag", 3, 2),
      ],
    },
  },
  // Gewerbe
  {
    id: "kino",
    name: "Kino",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-metal" },
      roof: { partId: "roof-shopfront" },
      floors: 2,
      parts: [
        at("window-shop", 0, 0),
        at("door-glass", 2, 0),
        at("door-glass", 3, 0),
        at("window-shop", 5, 0),
        at("window-round", 1, 1),
        at("window-round", 4, 1),
        at("deco-neon", 2, 1, "FILM"),
        at("deco-neon", 3, 1, "POPCORN"),
        at("deco-flag", 0, 2),
      ],
    },
  },
  {
    id: "einkaufszentrum",
    name: "Einkaufszentrum",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-glass" },
      roof: { partId: "roof-shopfront" },
      floors: 3,
      parts: [
        at("window-shop", 0, 0),
        at("window-shop", 1, 0),
        at("door-glass", 2, 0),
        at("door-glass", 3, 0),
        at("window-shop", 4, 0),
        at("window-shop", 5, 0),
        at("window-square", 1, 1),
        at("window-square", 4, 1),
        at("window-square", 1, 2),
        at("window-square", 4, 2),
        at("deco-awning", 0, 0),
        at("deco-awning", 5, 0),
        at("deco-neon", 2, 1, "SALE"),
      ],
    },
  },
  {
    id: "freizeitpark",
    name: "Freizeitpark",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-gummy" },
      roof: { partId: "roof-dome" },
      floors: 2,
      parts: [
        at("door-glass", 2, 0),
        at("door-glass", 3, 0),
        at("window-shop", 1, 0),
        at("window-shop", 4, 0),
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
      base: { partId: "base-tiles" },
      roof: { partId: "roof-shopfront" },
      floors: 2,
      parts: [
        at("door-glass", 3, 0),
        at("window-shop", 2, 0),
        at("window-round", 0, 1),
        at("window-round", 2, 1),
        at("window-round", 4, 1),
        at("deco-palm", 1, 0),
        at("deco-palm", 5, 0),
      ],
    },
  },
  {
    id: "klaeranlage",
    name: "Kläranlage",
    size: "L",
    use: "commercial",
    facade: {
      base: { partId: "base-metal" },
      roof: { partId: "roof-sawtooth" },
      floors: 1,
      parts: [
        at("door-shop", 1, 0),
        at("window-round", 2, 0),
        at("window-round", 3, 0),
        at("window-round", 4, 0),
        at("deco-antenna", 5, 1),
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
      roof: { partId: "roof-sawtooth" },
      floors: 3,
      parts: [
        at("door-glass", 3, 0),
        at("window-shop", 2, 0),
        at("window-square", 1, 1),
        at("window-square", 4, 1),
        at("window-arch", 2, 2),
        at("deco-fountain", 1, 0),
        at("deco-fountain", 5, 0),
      ],
    },
  },
];

export function templatesFor(size: PlotSize, use?: BuildingUse): Template[] {
  return TEMPLATES.filter((t) => t.size === size && (!use || t.use === use));
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
