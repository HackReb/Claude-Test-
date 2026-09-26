import type { BotCharacter } from "../model/types";

export interface Persona {
  name: string;
  avatar: string;
  character: BotCharacter;
  /** Straßenname, falls keine echte Nachbarstraße gefunden wird. */
  fallbackStreet: string;
  /** Kurzbeschreibung des Charakters. */
  tagline: string;
}

/** Bot-Nachbarn (Konzept Abschnitt 7) – alle Werte hier anpassbar. */
export const BOTS = {
  personas: [
    { name: "Zucker-Zoe", avatar: "🍭", character: "sweet", fallbackStreet: "Zuckerallee", tagline: "Süßigkeiten-Fan" },
    { name: "Beton-Bernd", avatar: "🧱", character: "concrete", fallbackStreet: "Betonring", tagline: "Beton-Liebhaber" },
    { name: "Chaos-Chris", avatar: "🌀", character: "chaos", fallbackStreet: "Kuddelmuddelweg", tagline: "Chaot – baut alles durcheinander" },
    { name: "Palmen-Paula", avatar: "🌴", character: "nature", fallbackStreet: "Palmenweg", tagline: "Mag Holz, Palmen und Spitzdächer" },
    { name: "Disco-Dieter", avatar: "🪩", character: "party", fallbackStreet: "Discostraße", tagline: "Feiert gern – Neon und Flaggen" },
  ] satisfies Persona[],

  /** Alle wie viele Stunden ein Bot etwas tut. */
  actionEveryHours: { sweet: 4, concrete: 6, chaos: 2, nature: 5, party: 3 } satisfies Record<BotCharacter, number>,
  /** So viele Grundstücke sind beim Einzug schon bebaut. */
  startBuildings: 2,
  /** Höchstens so viele nachgeholte Aktionen pro Bot und App-Start. */
  maxCatchUpActions: 8,
  /** Wahrscheinlichkeit, bei freien Plätzen neu zu kaufen statt auszubauen. */
  buyChance: 0.65,
  newsLimit: 20,

  /** Lieblings-Bausteine je Charakter (Gewicht 6) – alles andere Gewicht 1, Abneigungen 0.2. */
  likes: {
    sweet: ["base-chocolate", "base-gummy", "base-ice", "roof-icing", "roof-dome", "deco-fountain", "deco-fence", "window-round"],
    concrete: ["base-brick", "roof-flat", "deco-antenna", "window-square", "door-shop", "door-glass"],
    chaos: [],
    nature: ["base-wood", "roof-pitched", "deco-palm", "window-arch", "door-arch", "deco-fence"],
    party: ["deco-neon", "deco-flag", "roof-dome", "roof-battlements", "door-glass", "base-ice"],
  } satisfies Record<BotCharacter, string[]>,
  dislikes: {
    sweet: ["base-brick", "deco-antenna"],
    concrete: ["base-gummy", "base-chocolate", "roof-icing", "deco-neon", "deco-palm"],
    chaos: [],
    nature: ["deco-antenna", "deco-neon", "base-brick"],
    party: ["roof-flat", "base-wood"],
  } satisfies Record<BotCharacter, string[]>,
} as const;

export function partWeight(character: BotCharacter, partId: string): number {
  if ((BOTS.likes[character] as readonly string[]).includes(partId)) return 6;
  if ((BOTS.dislikes[character] as readonly string[]).includes(partId)) return 0.2;
  return 1;
}

export function personaOf(character: BotCharacter): Persona | undefined {
  return BOTS.personas.find((p) => p.character === character);
}
