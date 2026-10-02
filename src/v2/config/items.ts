/**
 * Babo v2: Waren und Figur. Jede Ware sitzt an einem Platz der Figur (Slot) und hat eine Form,
 * drei Farben und ein Muster. Aus Beschreibungen wie „grün-blau gepunkteter Dino“ macht der Designer
 * genau so ein Design – deterministisch, damit alle dasselbe sehen.
 */
import type { ShopGroup } from "./shops";

export type Slot = "hat" | "face" | "top" | "legs" | "feet" | "hand" | "back" | "pet" | "ride";
export type Pattern = "plain" | "dots" | "stripes" | "checks";

export const SLOTS: Record<Slot, { name: string; emoji: string }> = {
  hat: { name: "Kopf", emoji: "🎩" },
  face: { name: "Gesicht", emoji: "👓" },
  top: { name: "Oberteil", emoji: "👕" },
  legs: { name: "Hose", emoji: "👖" },
  feet: { name: "Schuhe", emoji: "👟" },
  hand: { name: "Hand", emoji: "✋" },
  back: { name: "Rücken", emoji: "🎒" },
  pet: { name: "Begleiter", emoji: "🐾" },
  ride: { name: "Fahrzeug", emoji: "🛴" },
};

export const SLOT_ORDER: Slot[] = ["hat", "face", "top", "legs", "feet", "hand", "back", "pet", "ride"];

export interface Shape {
  id: string;
  name: string;
  /** Wörter in der Beschreibung, die zu dieser Form führen (klein geschrieben, Wortanfänge reichen). */
  keywords: string[];
}

/** Die Formen je Platz – das ist das „Skelett“, auf das jede Beschreibung abgebildet wird. */
export const SHAPES: Record<Slot, Shape[]> = {
  hat: [
    { id: "cap", name: "Kappe", keywords: ["kappe", "cap", "basecap", "mütze", "muetze"] },
    { id: "tophat", name: "Zylinder", keywords: ["zylinder", "tophat"] },
    { id: "crown", name: "Krone", keywords: ["krone", "könig", "koenig", "prinz", "queen", "king"] },
    { id: "helmet", name: "Helm", keywords: ["helm", "ritter", "astronaut", "raumfahrer"] },
    { id: "beanie", name: "Bommelmütze", keywords: ["bommel", "beanie", "wollmütze", "winter"] },
    { id: "wizard", name: "Zauberhut", keywords: ["zauber", "hexe", "magier", "spitz"] },
    { id: "pirate", name: "Piratenhut", keywords: ["pirat", "kapitän", "kapitaen"] },
    { id: "cowboy", name: "Cowboyhut", keywords: ["cowboy", "abenteurer", "indiana", "fedora", "western"] },
    { id: "antenna", name: "Alien-Antennen", keywords: ["alien", "antenne", "außerirdisch", "ausserirdisch", "ufo"] },
    { id: "bow", name: "Schleife", keywords: ["schleife", "bow", "haarband"] },
  ],
  face: [
    { id: "glasses", name: "Brille", keywords: ["brille", "nerd", "lesebrille"] },
    { id: "sunglasses", name: "Sonnenbrille", keywords: ["sonnenbrille", "cool", "pilot"] },
    { id: "monocle", name: "Monokel", keywords: ["monokel", "lord", "graf"] },
    { id: "beard", name: "Bart", keywords: ["bart", "vollbart", "rauschebart"] },
    { id: "mustache", name: "Schnurrbart", keywords: ["schnurrbart", "schnauzer", "moustache"] },
    { id: "eyepatch", name: "Augenklappe", keywords: ["augenklappe", "pirat"] },
    { id: "mask", name: "Maske", keywords: ["maske", "superheld", "held", "räuber", "raeuber"] },
    { id: "nose", name: "Clownsnase", keywords: ["clown", "nase"] },
  ],
  top: [
    { id: "shirt", name: "T-Shirt", keywords: ["shirt", "t-shirt", "hemd"] },
    { id: "jacket", name: "Jacke", keywords: ["jacke", "mantel", "weste"] },
    { id: "dress", name: "Kleid", keywords: ["kleid", "rock", "prinzessin"] },
    { id: "armor", name: "Rüstung", keywords: ["rüstung", "ruestung", "ritter", "panzer"] },
    { id: "suit", name: "Anzug", keywords: ["anzug", "smoking", "krawatte", "fliege"] },
    { id: "hoodie", name: "Hoodie", keywords: ["hoodie", "kapuze", "pulli", "pullover"] },
    { id: "coat", name: "Kittel", keywords: ["kittel", "arzt", "ärztin", "labor", "koch"] },
    { id: "spacesuit", name: "Raumanzug", keywords: ["raumanzug", "astronaut", "weltraum"] },
    { id: "stripes", name: "Ringelshirt", keywords: ["ringel", "matrose", "seemann"] },
  ],
  legs: [
    { id: "pants", name: "Hose", keywords: ["hose", "jeans"] },
    { id: "shorts", name: "Shorts", keywords: ["shorts", "kurze", "badehose"] },
    { id: "skirt", name: "Rock", keywords: ["rock", "tutu"] },
    { id: "overalls", name: "Latzhose", keywords: ["latz", "bauarbeiter", "handwerker"] },
  ],
  feet: [
    { id: "sneakers", name: "Turnschuhe", keywords: ["turnschuh", "sneaker", "sport"] },
    { id: "boots", name: "Stiefel", keywords: ["stiefel", "boots", "gummistiefel"] },
    { id: "skates", name: "Rollschuhe", keywords: ["rollschuh", "inliner", "skates"] },
    { id: "flipflops", name: "Flipflops", keywords: ["flipflop", "sandale", "latschen", "strand"] },
    { id: "heels", name: "Stöckelschuhe", keywords: ["stöckel", "stoeckel", "absatz", "pumps"] },
    { id: "clown", name: "Clownsschuhe", keywords: ["clown", "riesen"] },
  ],
  hand: [
    { id: "whip", name: "Peitsche", keywords: ["peitsche", "indiana", "abenteurer"] },
    { id: "sword", name: "Schwert", keywords: ["schwert", "säbel", "saebel", "degen", "ritter", "pirat"] },
    { id: "lightsaber", name: "Lichtschwert", keywords: ["lichtschwert", "laser", "jedi", "sith"] },
    { id: "guitar", name: "Gitarre", keywords: ["gitarre", "bass", "ukulele", "rock"] },
    { id: "umbrella", name: "Regenschirm", keywords: ["schirm", "regen"] },
    { id: "wand", name: "Zauberstab", keywords: ["zauberstab", "zauber", "stab", "magie"] },
    { id: "balloon", name: "Luftballon", keywords: ["ballon", "luftballon"] },
    { id: "icecream", name: "Eis", keywords: ["eis", "waffel", "eistüte"] },
    { id: "phone", name: "Handy", keywords: ["handy", "smartphone", "telefon"] },
    { id: "flower", name: "Blume", keywords: ["blume", "rose", "tulpe", "strauß", "strauss"] },
    { id: "ball", name: "Ball", keywords: ["ball", "fußball", "fussball", "basketball"] },
    { id: "trumpet", name: "Trompete", keywords: ["trompete", "tröte", "troete", "horn"] },
    { id: "book", name: "Buch", keywords: ["buch", "comic", "zeitung"] },
    { id: "shield", name: "Schild", keywords: ["schild"] },
  ],
  back: [
    { id: "cape", name: "Umhang", keywords: ["umhang", "cape", "superheld", "held", "vampir", "könig"] },
    { id: "backpack", name: "Rucksack", keywords: ["rucksack", "schulranzen", "wanderer"] },
    { id: "wings", name: "Flügel", keywords: ["flügel", "fluegel", "engel", "fee", "schmetterling"] },
    { id: "jetpack", name: "Jetpack", keywords: ["jetpack", "rakete", "düse", "duese"] },
    { id: "parrot", name: "Papagei", keywords: ["papagei", "pirat"] },
    { id: "guitarcase", name: "Gitarrenkoffer", keywords: ["koffer", "musiker"] },
  ],
  pet: [
    { id: "dog", name: "Hund", keywords: ["hund", "dackel", "welpe", "wauwau"] },
    { id: "cat", name: "Katze", keywords: ["katze", "kater", "miez"] },
    { id: "dino", name: "Dino", keywords: ["dino", "saurier", "rex", "raptor"] },
    { id: "dragon", name: "Drache", keywords: ["drache", "dragon"] },
    { id: "unicorn", name: "Einhorn", keywords: ["einhorn", "pferd", "pony"] },
    { id: "robot", name: "Roboter", keywords: ["roboter", "robot", "androide"] },
    { id: "bird", name: "Vogel", keywords: ["vogel", "papagei", "huhn", "ente", "pinguin"] },
    { id: "fish", name: "Fisch im Glas", keywords: ["fisch", "aquarium", "goldfisch", "hai"] },
    { id: "pig", name: "Schwein", keywords: ["schwein", "ferkel"] },
    { id: "octopus", name: "Krake", keywords: ["krake", "oktopus", "tintenfisch"] },
    { id: "ghost", name: "Gespenst", keywords: ["gespenst", "geist", "spuk"] },
  ],
  ride: [
    { id: "bike", name: "Fahrrad", keywords: ["fahrrad", "rad", "bike", "rennrad"] },
    { id: "scooter", name: "Roller", keywords: ["roller", "scooter", "tretroller"] },
    { id: "car", name: "Auto", keywords: ["auto", "cabrio", "flitzer", "wagen", "laster"] },
    { id: "rocket", name: "Rakete", keywords: ["rakete", "raumschiff", "ufo", "gleiter"] },
    { id: "skateboard", name: "Skateboard", keywords: ["skateboard", "board"] },
    { id: "broom", name: "Besen", keywords: ["besen", "hexe", "zauber"] },
    { id: "horse", name: "Steckenpferd", keywords: ["steckenpferd", "pferd", "ritter"] },
  ],
};

/** Welche Plätze ein Ladentyp beliefert (die erste Angabe ist die Vorgabe). */
export const SLOTS_BY_TYPE: Record<string, Slot[]> = {
  mode: ["top", "legs", "hat"],
  hutmacher: ["hat"],
  schuhladen: ["feet"],
  optiker: ["face"],
  kostuemverleih: ["top", "hat", "face", "back"],
  schmuck: ["hat", "face"],
  tierhandlung: ["pet"],
  aquarium: ["pet"],
  fabelzoo: ["pet"],
  elektronik: ["hand", "back"],
  videospiele: ["hand", "top"],
  roboterwerkstatt: ["pet", "back"],
  sportladen: ["hand", "feet", "top"],
  musikladen: ["hand", "back"],
  spielwaren: ["hand", "pet"],
  zauberladen: ["hand", "hat", "ride"],
  buchladen: ["hand", "face"],
  fahrradladen: ["ride"],
  autohaus: ["ride"],
  raumschiffwerft: ["ride", "back"],
  drogerie: ["face", "hat"],
  friseur: ["hat", "face"],
  blumenladen: ["hand", "hat"],
  baeckerei: ["hand"],
  eisdiele: ["hand"],
  doener: ["hand"],
  supermarkt: ["hand", "feet"],
  kiosk: ["hand", "face"],
  ruestungsschmiede: ["top", "hat", "hand"],
  piratenbedarf: ["hat", "face", "hand", "back"],
  weltraumladen: ["top", "hat", "back", "ride"],
  hexenkueche: ["hat", "hand", "ride", "pet"],
  dinoladen: ["pet"],
  superheldenbedarf: ["back", "face", "top"],
};

export const slotsForType = (typeId: string): Slot[] => SLOTS_BY_TYPE[typeId] ?? ["hand"];

/** Farbwörter in Beschreibungen. */
export const COLOR_WORDS: [string, string][] = [
  ["rot", "#e63946"],
  ["grün", "#2ec27e"],
  ["gruen", "#2ec27e"],
  ["blau", "#1982c4"],
  ["gelb", "#ffd166"],
  ["orange", "#ff7a45"],
  ["lila", "#8338ec"],
  ["violett", "#8338ec"],
  ["pink", "#ff5d8f"],
  ["rosa", "#ffafcc"],
  ["türkis", "#06d6a0"],
  ["tuerkis", "#06d6a0"],
  ["schwarz", "#2b2118"],
  ["weiß", "#ffffff"],
  ["weiss", "#ffffff"],
  ["grau", "#8d99ae"],
  ["braun", "#8d5524"],
  ["gold", "#e0a800"],
  ["silber", "#c0c6cf"],
  ["beige", "#e9d8a6"],
  ["neon", "#b7ff5a"],
  ["regenbogen", "#ff5d8f"],
];

export const PALETTE = ["#e63946", "#2ec27e", "#1982c4", "#ffd166", "#ff7a45", "#8338ec", "#ff5d8f", "#06d6a0", "#8d5524", "#2b2118", "#ffffff", "#e0a800"];

export const PATTERN_WORDS: [string, Pattern][] = [
  ["gepunktet", "dots"],
  ["punkte", "dots"],
  ["pünktchen", "dots"],
  ["tupfen", "dots"],
  ["gestreift", "stripes"],
  ["streifen", "stripes"],
  ["ringel", "stripes"],
  ["kariert", "checks"],
  ["karo", "checks"],
  ["schach", "checks"],
];

export const PATTERN_NAMES: Record<Pattern, string> = { plain: "einfarbig", dots: "gepunktet", stripes: "gestreift", checks: "kariert" };

export interface ItemDesign {
  slot: Slot;
  shape: string;
  /** Hauptfarbe, Zweitfarbe, Akzent. */
  colors: [string, string, string];
  pattern: Pattern;
}

/** Wie viele Waren man pro Tag erfinden darf und was es kostet. */
export const INVENT = {
  perDay: 5,
  cost: 50,
  priceMin: 10,
  priceMax: 5000,
  priceDefault: 120,
  itemsPerShop: 12,
  showcasePerShop: 6,
  descriptionMax: 80,
} as const;

/** Grundaussehen der Figur. */
export const SKINS = ["#f1c7a3", "#d9a066", "#a86b3c", "#7a4a2a", "#ffdbac", "#c68642"];
export const HAIR_COLORS = ["#2b2118", "#6b4226", "#e0b050", "#b5533c", "#555555", "#ff5d8f", "#1982c4", "#2ec27e"];
export type HairStyle = "short" | "long" | "curly" | "bald" | "bun" | "spiky";
export const HAIR_STYLES: { id: HairStyle; name: string }[] = [
  { id: "short", name: "Kurz" },
  { id: "long", name: "Lang" },
  { id: "curly", name: "Lockig" },
  { id: "bun", name: "Dutt" },
  { id: "spiky", name: "Stachelig" },
  { id: "bald", name: "Glatze" },
];

export type ShopGroupOf = ShopGroup;
