import { hashString, seededRandom } from "../../game/random";
import { COLOR_WORDS, PALETTE, PATTERN_WORDS, SHAPES, type ItemDesign, type Pattern, type Slot } from "../config/items";

const normalize = (text: string) => text.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();

/** Farben aus der Beschreibung, in der Reihenfolge, wie sie vorkommen („grün-blau“ → grün, blau). */
export function colorsIn(text: string): string[] {
  const lower = normalize(text);
  const found: { at: number; hex: string }[] = [];
  for (const [word, hex] of COLOR_WORDS) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(word, from);
      if (at < 0) break;
      found.push({ at, hex });
      from = at + word.length;
    }
  }
  const ordered = found.sort((a, b) => a.at - b.at).map((f) => f.hex);
  return ordered.filter((hex, i) => ordered.indexOf(hex) === i);
}

export function patternIn(text: string): Pattern | null {
  const lower = normalize(text);
  for (const [word, pattern] of PATTERN_WORDS) if (lower.includes(word)) return pattern;
  return null;
}

/** Die Form, die am besten zur Beschreibung passt – das zuerst genannte Schlüsselwort gewinnt. */
export function shapeIn(text: string, slot: Slot): string | null {
  const lower = normalize(text);
  let best: { at: number; id: string } | null = null;
  for (const shape of SHAPES[slot]) {
    for (const word of shape.keywords) {
      const at = lower.indexOf(word);
      if (at >= 0 && (best === null || at < best.at)) best = { at, id: shape.id };
    }
  }
  return best?.id ?? null;
}

/**
 * Macht aus einer Beschreibung ein Design: Farben, Muster und Form aus den Wörtern, der Rest fest
 * ausgewürfelt (gleiche Beschreibung = gleiches Design). So sieht alles nach Babo aus und jede
 * Beschreibung ergibt etwas – auch ohne KI. Eine echte KI kann später dasselbe Format liefern.
 */
export function designFromText(text: string, slot: Slot): ItemDesign {
  const random = seededRandom(hashString(`design:${slot}:${normalize(text)}`));
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const colors = colorsIn(text);
  const shape = shapeIn(text, slot) ?? pick(SHAPES[slot]).id;
  const pattern = patternIn(text) ?? (random() < 0.25 ? pick(["dots", "stripes", "checks"] as const) : "plain");
  const primary = colors[0] ?? pick(PALETTE);
  const secondary = colors[1] ?? pick(PALETTE.filter((c) => c !== primary));
  const accent = colors[2] ?? (colors.length === 1 ? "#ffd166" : pick(PALETTE.filter((c) => c !== primary && c !== secondary)));
  return { slot, shape, colors: [primary, secondary, accent], pattern };
}

/** Kurze Beschreibung eines Designs für Listen („Dino, grün gepunktet“). */
export function describeDesign(design: ItemDesign): string {
  const shape = SHAPES[design.slot].find((s) => s.id === design.shape)?.name ?? "Ware";
  const pattern = design.pattern === "plain" ? "" : design.pattern === "dots" ? ", gepunktet" : design.pattern === "stripes" ? ", gestreift" : ", kariert";
  return `${shape}${pattern}`;
}
