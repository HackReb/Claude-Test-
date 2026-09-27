/**
 * Tierhandlung: Tiere gehen regelmäßig in der Nachbarschaft spazieren und hinterlassen dort Haufen –
 * je größer das Tier, desto mehr. Alle Werte hier anpassbar.
 */

export interface Species {
  id: string;
  name: string;
  emoji: string;
  price: number;
  /** Futter & Tierarzt pro Stunde. */
  upkeepPerHour: number;
  /** Haufen pro Ausflug in eine Nachbarstraße. */
  poopPerOuting: number;
  /** Alle so viele Stunden geht es auf Ausflug. */
  outingEveryHours: number;
  /** Vorschlag für den Namen. */
  names: string[];
  blurb: string;
}

export const SPECIES: Species[] = [
  { id: "katze", name: "Katze", emoji: "🐈", price: 600, upkeepPerHour: 2.4, poopPerOuting: 1, outingEveryHours: 10, names: ["Mieze", "Garfield", "Schnurri"], blurb: "Geht ihre eigenen Wege. Meistens in fremde Vorgärten." },
  { id: "dackel", name: "Dackel", emoji: "🐕", price: 1000, upkeepPerHour: 4, poopPerOuting: 2, outingEveryHours: 8, names: ["Waldi", "Bello", "Herr Wurst"], blurb: "Kurze Beine, großes Geschäft." },
  { id: "schwein", name: "Hausschwein", emoji: "🐖", price: 2000, upkeepPerHour: 8, poopPerOuting: 3, outingEveryHours: 10, names: ["Rosi", "Babe", "Schnitzel"], blurb: "Sehr schlau. Sehr verdauungsfreudig." },
  { id: "pony", name: "Pony", emoji: "🐴", price: 3600, upkeepPerHour: 12, poopPerOuting: 4, outingEveryHours: 12, names: ["Fury", "Blitz", "Ponyhof"], blurb: "Lässt sich gern ausreiten – und fallen." },
  { id: "kamel", name: "Kamel", emoji: "🐪", price: 5600, upkeepPerHour: 16, poopPerOuting: 5, outingEveryHours: 14, names: ["Achmed", "Höcker", "Sandy"], blurb: "Spuckt nicht. Macht aber sonst alles." },
  { id: "elefant", name: "Elefant", emoji: "🐘", price: 12000, upkeepPerHour: 32, poopPerOuting: 8, outingEveryHours: 16, names: ["Benjamin", "Dumbo", "Törööö"], blurb: "Der Endgegner jeder Nachbarschaft. Törööö!" },
];

export const species = (id: string) => SPECIES.find((s) => s.id === id);

export const PETS = {
  /** So viele Tiere passen in die eigene Straße. */
  maxPets: 5,
  nameMaxLength: 20,
  /** Nach langer Abwesenheit werden je Tier bzw. Auto höchstens so viele Ausflüge nachgeholt. */
  maxCatchUp: 2,
} as const;

/** Autos fahren auch durch die Nachbarschaft: alle so viele Stunden, Ruß je nach Modell (siehe config/cars.ts). */
export const CAR_OUTINGS = {
  everyHours: 12,
  /** Ruß an einer Fassade stört die Bewohner wie so viele Dreck-Teile je Stufe. */
  sootAsLitter: 1,
  /** Mehr Ruß als so viele Stufen setzt sich an einem Haus nicht fest. */
  maxSoot: 4,
  /** Fassade waschen. */
  washCost: 60,
} as const;
