/**
 * Was auf der Straße zu sehen ist: die echten Bewohner und ab und zu eine Show zum Zuschauen.
 * Alle Werte hier anpassbar.
 */
export const STREET_LIFE = {
  /** Mehr Figuren gleichzeitig zeichnen wir nicht – bei vielen Bewohnern ist der Rest gerade zuhause. */
  maxWalkers: 24,
  /** Anteil der Kinder unter den Bewohnern. */
  kidShare: 0.3,
  /** Gehtempo (Pixel pro Sekunde). */
  adultSpeed: [22, 32],
  kidSpeed: [36, 50],
  /** Wie lange jemand vor dem Haus steht, bevor er etwas Neues vorhat (Sekunden). */
  hangSeconds: [6, 16],
  /** So lange bleiben Leute drinnen – zuhause bzw. im Laden. */
  homeSeconds: [8, 25],
  shopSeconds: [3, 7],
  /** Was jemand als Nächstes macht (Erwachsene; der Rest: vor dem Haus bleiben und quatschen). */
  chances: { shop: 0.45, home: 0.2, visit: 0.2 },
} as const;

export type ShowKind = "circus" | "icecream" | "music" | "balloon" | "firetruck" | "wedding" | "duel" | "marathon";

export const SHOWS = {
  /** Erste Show kurz nach dem Öffnen der Straße, danach in diesen Abständen (Sekunden). */
  firstAfterSeconds: 25,
  gapSeconds: [70, 150],
  /** Die erste ist immer der Zirkus, danach bunt gemischt (nie zweimal dasselbe hintereinander). */
  order: ["circus", "icecream", "music", "balloon", "firetruck", "wedding", "duel", "marathon"] as ShowKind[],
  /** Tempo der Parade (Pixel pro Sekunde) und wie lang der Zug ist. */
  paradeSpeed: 48,
  paradeLength: 420,
  /** Eiswagen: so lange hält er in der Mitte. */
  icecreamStopSeconds: 14,
  /** Straßenmusiker: so lange spielt er. */
  musicSeconds: 16,
  balloonSeconds: 30,
  /** Feuerwehr: so lange steht sie (Leiter hoch, Katze retten, Leiter runter). */
  fireStopSeconds: 12,
  /** Hochzeitskorso und Stadtlauf fahren bzw. rennen schneller als die Parade. */
  weddingSpeed: 70,
  weddingLength: 330,
  marathonSpeed: 85,
  marathonLength: 380,
  /** Lichtschwertduell: kommen, kämpfen, verbeugen, gehen. */
  duelSeconds: 20,
  names: {
    circus: "🎪 Der Zirkus Baboni zieht durch die Straße!",
    icecream: "🍦 Der Eiswagen ist da!",
    music: "🎸 Ein Straßenmusiker spielt auf!",
    balloon: "🎈 Ein Heißluftballon schwebt vorbei!",
    firetruck: "🚒 Tatütata! Die Feuerwehr rettet eine Katze!",
    wedding: "💒 Hochzeitskorso! Hupen, Dosen, Glückwünsche!",
    duel: "⚔️ Zwei Weltraumritter ziehen ihre Lichtschwerter!",
    marathon: "🏃 Der Stadtlauf kommt durch – mit Bananen-Läufer!",
  } as Record<ShowKind, string>,
} as const;
