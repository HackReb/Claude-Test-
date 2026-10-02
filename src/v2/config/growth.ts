/** Babo v2: Wie die Straße wächst und was die Läden einbringen – alle Zahlen hier anpassbar. */
export const GROWTH = {
  /** Bauplätze: links und rechts der Mall (oben) und gegenüber (unten). */
  lotsBesideMall: 3,
  lotsOpposite: 7,
  /** Anziehungskraft der Straße (0–1): Grundwert plus je Ladengruppe, je Laden und je Mitspieler. */
  baseAttraction: 0.2,
  perGroup: 0.1,
  perShop: 0.04,
  perMember: 0.02,
  /**
   * Ein Bauplatz wächst nur, wenn die Anziehungskraft über seiner Schwelle liegt; je weiter darüber
   * (gemessen am Weg bis 1), desto größer das Haus. Bei voller Anziehung sind alle Plätze Wohnblöcke.
   */
  stagesPerAttraction: 5,
  /** Zeit bremst: alle so viele Minuten nach der Gründung darf ein Haus eine Stufe höher sein. */
  minutesPerStage: 12,
  /** Bewohner je Haus-Stufe: Bauland, Baustelle, Häuschen, Stadthaus, Wohnblock. */
  capacity: [0, 0, 4, 10, 24] as const,
  /** Belegung der Häuser: Grund plus Anteil der Anziehungskraft. */
  baseOccupancy: 0.5,
} as const;

export const MALL = {
  /** Läden je Stockwerk; mehr Läden = mehr Stockwerke (von selbst). */
  shopsPerFloor: 4,
  maxFloors: 6,
} as const;

export const ECONOMY2 = {
  startCoins: 2000,
  /** Eröffnung des ersten, zweiten, dritten Ladens. */
  openCost: [0, 1500, 4000] as const,
  /** Umsatz je Laden und Stunde: Laufkundschaft plus je Bewohner – geteilt durch Läden desselben Typs. */
  walkInPerHour: 12,
  perResidentPerHour: 1.5,
  /** Länger als so viele Stunden sammelt eine Kasse nicht (wer lange weg war, bekommt nicht alles). */
  maxOfflineHours: 72,
} as const;

export const STREET_MAX_MEMBERS = 50;
