/** Autohaus: Fantasie-Marken (bewusst keine echten Marken – die sind geschützt). */

export type CarType = "hatch" | "van" | "sedan" | "suv" | "sport" | "ev" | "tiny" | "retro";
export type HornSound = "meep" | "honk" | "troet" | "vroom" | "surr" | "knatter";

export interface CarModel {
  id: string;
  brand: string;
  model: string;
  type: CarType;
  price: number;
  /** Fahrgeschwindigkeit in Straßen-Einheiten pro Sekunde. */
  speed: number;
  horn: HornSound;
  /** Kurzer Werbespruch fürs Autohaus. */
  slogan: string;
  /**
   * Abgase: So viel Ruß hinterlässt das Auto an einer Fassade, wenn es durch eine Nachbarstraße fährt
   * (0 = Elektro, sauber).
   */
  soot: number;
}

export const CAR_MODELS: CarModel[] = [
  { id: "knatterwerk-rennpappe", brand: "Knatterwerk", model: "Rennpappe", type: "retro", price: 500, speed: 45, horn: "knatter", slogan: "Knattert zuverlässig seit 1964.", soot: 3 },
  { id: "volksflitzer-knirps", brand: "Volksflitzer", model: "Knirps", type: "hatch", price: 800, speed: 65, horn: "honk", slogan: "Das Auto fürs Volk. Und für dich.", soot: 1 },
  { id: "fiasko-500", brand: "Fiasko", model: "500", type: "tiny", price: 900, speed: 60, horn: "meep", slogan: "Klein, rund, passt in jede Lücke.", soot: 1 },
  { id: "volksflitzer-bulli", brand: "Volksflitzer", model: "Bulli Hippie", type: "van", price: 1500, speed: 50, horn: "troet", slogan: "Peace, Love und Platz für acht.", soot: 2 },
  { id: "sternchen-bonbon", brand: "Sternchen-Werke", model: "Bonbon", type: "sedan", price: 3000, speed: 75, horn: "honk", slogan: "Luxus, der schmilzt – nur nicht in der Sonne.", soot: 1 },
  { id: "mottenwerke-xprotz", brand: "Bayerische Mottenwerke", model: "X-Protz", type: "suv", price: 3500, speed: 70, horn: "honk", slogan: "Für jeden Bordstein bereit.", soot: 3 },
  { id: "voltarello-blitz", brand: "Voltarello", model: "Blitz", type: "ev", price: 4200, speed: 85, horn: "surr", slogan: "Lautlos schnell. Fast zu leise zum Angeben.", soot: 0 },
  { id: "borsche-911ish", brand: "Borsche", model: "911-ish", type: "sport", price: 6000, speed: 110, horn: "vroom", slogan: "Wrrrooom. Mehr muss man nicht sagen.", soot: 2 },
];

export const CAR_COLORS = ["#e63946", "#1982c4", "#ffca3a", "#06d6a0", "#f5f5f5", "#3a3a4a", "#ff7a45", "#c77dff"] as const;

export const CARS = {
  /** So viele eigene Autos fahren höchstens auf der Straße. */
  maxCars: 5,
  plateMaxLength: 10,
  carNameMaxLength: 24,
  /** Fremder Verkehr: Grundzahl + je Laden ein Auto mehr (bis zum Maximum). */
  trafficBase: 2,
  trafficMax: 6,
} as const;

export const carModel = (id: string) => CAR_MODELS.find((m) => m.id === id);
