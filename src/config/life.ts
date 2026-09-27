/** Leben auf der Straße: Bewohner, Kundschaft, Müll, Wünsche – alle Werte hier anpassbar. */
export const LIFE = {
  /** Neuer Müll pro Stunde (auch während niemand zuschaut). */
  trashPerHourPerShop: 0.3,
  trashPerHourPerHome: 0.1,
  poopPerHourPerHome: 0.15,
  /** Höchstens so viel Dreck liegt gleichzeitig herum. */
  maxLitter: 12,
  /** Ab so viel Dreck beschweren sich die Bewohner. */
  dirtyThreshold: 3,

  // ---------- Bewohner ----------
  /**
   * Wie viele Plätze ein Gebäude füllen kann (0–1), ergibt sich aus der Wohlfühl-Liste der Straße.
   * Sauberkeit: je Dreck-Teil weniger, höchstens bis auf `minCleanliness`.
   */
  litterComfortLoss: 0.07,
  minCleanliness: 0.15,
  /** Ohne Spielplatz in der Straße füllen sich Wohnhäuser höchstens zu 75 %. */
  noPlaygroundFactor: 0.75,
  /** Ohne Laden zum Einkaufen in der Straße höchstens zu 80 %. */
  noShopFactor: 0.8,
  /** Laufkundschaft: so ausgelastet ist ein Laden auch ganz ohne Bewohner in der Straße. */
  walkInCustomers: 0.3,
  /** Läden stört Dreck weniger als Bewohner. */
  shopLitterLoss: 0.04,
  shopMinCleanliness: 0.5,

  /**
   * Anteil der Plätze, der pro Stunde einzieht bzw. auszieht, bis das Ziel erreicht ist.
   * Einziehen geht schnell (ein neues Haus ist in gut einer halben Stunde voll, während man spielt),
   * Ausziehen langsam: eine volle Straße leert sich bei Vernachlässigung über zwei bis drei Tage.
   */
  moveInPerHour: 1.2,
  moveOutPerHour: 0.012,
  /** Neue Gebäude starten nicht leer: so viel zieht sofort ein (Anteil der Plätze). */
  firstResidents: 0.25,

  playgroundCost: 600,

  tapsToClean: { trash: 1, poop: 3 },
  cleanReward: { trash: 8, poop: 20 },
  /** Live auf dem Bildschirm: frühestens alle so viele Sekunden neuer Dreck. */
  liveLitterEverySeconds: 25,
} as const;
