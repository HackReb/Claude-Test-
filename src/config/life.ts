/** Leben auf der Straße: Bewohner, Kundschaft, Müll, Wünsche – alle Werte hier anpassbar. */
export const LIFE = {
  /** Neuer Müll pro Stunde (während niemand zuschaut). */
  trashPerHourPerShop: 0.3,
  trashPerHourPerHome: 0.1,
  poopPerHourPerHome: 0.15,
  /** Höchstens so viel Dreck liegt gleichzeitig herum. */
  maxLitter: 12,
  /** Offline wird höchstens so viele Stunden Müll nachgewürfelt. */
  maxOfflineHours: 24,

  /** Miet-Abzug je Müll-Teil (4 %), höchstens 40 %. */
  litterRentPenalty: 0.04,
  maxLitterPenalty: 0.4,
  /** Ab so viel Dreck beschweren sich die Bewohner. */
  dirtyThreshold: 3,

  playgroundCost: 300,
  /** Wohnhäuser zahlen mit Spielplatz in der Straße mehr. */
  playgroundBonus: 0.1,
  /** Gewerbe verdient mehr, je mehr Wohnhäuser (Kundschaft) es gibt. */
  customerBonusPerHome: 0.05,
  maxCustomerBonus: 0.25,

  tapsToClean: { trash: 1, poop: 3 },
  cleanReward: { trash: 2, poop: 5 },
  /** Live auf dem Bildschirm: frühestens alle so viele Sekunden neuer Dreck. */
  liveLitterEverySeconds: 25,
} as const;
