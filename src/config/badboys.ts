/** Bad Boys: Man schickt sie gegen Geld in Nachbarstraßen, wo sie Ärger machen. Alle Werte hier anpassbar. */

export type MischiefKind = "trash" | "poop" | "graffiti" | "smash" | "soot";

export interface BadBoy {
  id: string;
  name: string;
  emoji: string;
  price: number;
  kind: MischiefKind;
  /** Wie viel: Müll-/Haufen-Teile, bei Graffiti und Kaputtmachen immer 1 Gebäude. */
  amount: number;
  blurb: string;
}

export const BAD_BOYS: BadBoy[] = [
  { id: "kaugummi-klaus", name: "Kaugummi-Klaus", emoji: "🫧", price: 320, kind: "trash", amount: 3, blurb: "Klebt Kaugummi an alles und lässt Chipstüten fallen." },
  { id: "gassi-gabi", name: "Gassi-Gabi mit drei Dackeln", emoji: "🐕", price: 440, kind: "poop", amount: 3, blurb: "Geht dreimal täglich Gassi. Tüten hat sie nie dabei." },
  { id: "muelltonnen-marvin", name: "Mülltonnen-Marvin", emoji: "🗑️", price: 640, kind: "trash", amount: 6, blurb: "Wirft aus Langeweile alle Mülltonnen um." },
  { id: "spruehdosen-kevin", name: "Sprühdosen-Kevin", emoji: "🎨", price: 720, kind: "graffiti", amount: 1, blurb: "Hält sich für einen Künstler. Die Nachbarn nicht." },
  { id: "knallfrosch-zwillinge", name: "Die Knallfrosch-Zwillinge", emoji: "🧨", price: 1040, kind: "smash", amount: 1, blurb: "Machen Krach und dabei gern ein Fenster kaputt." },
];

export const badBoy = (id: string) => BAD_BOYS.find((b) => b.id === id);

/** Sprüche, die Sprühdosen-Kevin & Co. an Häuser sprühen. */
export const GRAFFITI_TAGS = [
  "KEVIN WAR HIER",
  "BABO?",
  "LOL",
  "Mett ist Gemüse",
  "Wer das liest, ist doof",
  "HUPEN!",
  "Ich ♥ Dackel",
  "Frag nicht",
  "Döner > alles",
  "Hier war Kunst",
];

export const MISCHIEF = {
  /** Graffiti stört die Bewohner wie so viele Dreck-Teile. */
  graffitiAsLitter: 2,
  /** Kaputte Fenster: das Haus füllt sich höchstens noch zu diesem Anteil. */
  damagedFactor: 0.5,
  /** Graffiti wegschrubben kostet Reinigungsmittel. */
  scrubCost: 100,
  /** Reparatur je Grundstücksgröße. */
  repairCost: { S: 240, M: 480, L: 1000 },
  /** So viele Vorfälle merkt sich eine Straße (für Neuigkeiten und die Zeitung). */
  incidentLimit: 20,
} as const;

/** Wachschutz für die eigene Straße: fängt einen Teil der Bad Boys ab. */
export const SECURITY = [
  { level: 1, name: "Nachbarschaftswache", emoji: "🦺", price: 1600, upkeepPerHour: 16, blockChance: 0.4 },
  { level: 2, name: "Wachdienst mit Kameras", emoji: "📹", price: 4800, upkeepPerHour: 40, blockChance: 0.75 },
] as const;

export const securityOf = (level: number | undefined) => SECURITY.find((s) => s.level === level);

/** Bots schicken auch mal jemanden vorbei: alle so viele Stunden (je Charakter), `null` = nie. */
export const BOT_MISCHIEF = {
  everyHours: { chaos: 20, party: 36, concrete: 60, sweet: 48, nature: 40 } as Record<string, number | null>,
  /** Wen welcher Bot bevorzugt schickt. */
  favorites: {
    chaos: ["spruehdosen-kevin", "muelltonnen-marvin", "knallfrosch-zwillinge"],
    party: ["kaugummi-klaus", "knallfrosch-zwillinge"],
    concrete: ["gassi-gabi", "auto-mottenwerke-xprotz"],
    // Zoe und Paula schicken keine Bad Boys – aber ihre Tiere gehen bei dir spazieren.
    sweet: ["tier-katze", "tier-dackel"],
    nature: ["tier-pony", "tier-schwein"],
  } as Record<string, string[]>,
  /** Wer einen Bot ärgert, bekommt schneller Besuch zurück (in Stunden) – aber nur von den Rachsüchtigen. */
  revengeAfterHours: 6,
  revengeful: ["chaos", "party", "concrete"] as string[],
  /** Höchstens so viele Bot-Streiche werden nach langer Abwesenheit nachgeholt. */
  maxCatchUp: 3,
} as const;
