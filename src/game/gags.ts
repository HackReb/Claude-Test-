import type { Facade } from "../model/types";

/** Kleine Szenen an Läden – je nachdem, was es dort gibt. */
export type GagKind =
  | "doner"
  | "optician"
  | "icecream"
  | "hair"
  | "bakery"
  | "pizza"
  | "stink"
  | "laundry"
  | "cinema"
  | "flowers"
  | "pool"
  | "balloon";

export interface Gag {
  kind: GagKind;
  /** Rasterzelle, an der die Szene spielt (Spezial-Fenster oder Schild). */
  x: number;
  y: number;
}

const BY_WINDOW: Record<string, GagKind> = {
  "window-doner": "doner",
  "window-optician": "optician",
  "window-icecream": "icecream",
};

/** Schild-Texte → Szene. Wortanfang zählt, damit „WEISS“ keine Eisdiele wird. */
const BY_TEXT: [RegExp, GagKind][] = [
  [/DÖNER|KEBAB/, "doner"],
  [/OPTIK|BRILLE/, "optician"],
  [/(^|[^A-Z])EIS|GELATO/, "icecream"],
  [/HAAR|FRISEUR/, "hair"],
  [/BÄCK|BROT|BREZEL/, "bakery"],
  [/PIZZA/, "pizza"],
  [/KLÄR/, "stink"],
  [/WASCH/, "laundry"],
  [/KINO|FILM/, "cinema"],
  [/BLUME/, "flowers"],
  [/(^|[^A-Z])BAD($|[^A-Z])|POOL/, "pool"],
  [/FUN|PARTY|HÜPF/, "balloon"],
];

/** Welche Szenen an dieser Fassade spielen (jede Art höchstens einmal). */
export function gagsOf(facade: Facade): Gag[] {
  const gags: Gag[] = [];
  const add = (kind: GagKind, x: number, y: number) => {
    if (!gags.some((g) => g.kind === kind)) gags.push({ kind, x, y });
  };
  for (const p of facade.parts) {
    const kind = BY_WINDOW[p.partId];
    if (kind) add(kind, p.x, p.y);
  }
  for (const p of facade.parts) {
    if (!p.text) continue;
    for (const [pattern, kind] of BY_TEXT) if (pattern.test(p.text)) add(kind, p.x, p.y);
  }
  return gags;
}
