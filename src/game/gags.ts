import type { Facade } from "../model/types";
import { getPart } from "../parts/catalog";

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
  [/(^|[^A-Z])EIS|GELAT/, "icecream"],
  [/HAAR|FRISEUR/, "hair"],
  [/BÄCK|BACK|BROT|BREZEL/, "bakery"],
  [/PIZZA/, "pizza"],
  [/KLÄR/, "stink"],
  [/WASCH/, "laundry"],
  [/KINO|FILM/, "cinema"],
  [/BLUME/, "flowers"],
  [/(^|[^A-Z])BAD($|[^A-Z])|SCHWIMM|POOL/, "pool"],
  [/FUN|PARTY|HÜPF|FREIZEIT/, "balloon"],
];

/**
 * Welche Szenen an dieser Fassade spielen (jede Art höchstens einmal).
 * Spezial-Fenster und Schilder zuerst, dann der Name des Ladens („Kalles Dönerbude“ → Döner).
 */
export function gagsOf(facade: Facade, name?: string): Gag[] {
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
  if (name) {
    // Beim Namen spielt die Szene am ersten Fenster im Erdgeschoss (sonst an der Tür).
    const ground = facade.parts.filter((p) => p.y === 0);
    const spot = ground.find((p) => getPart(p.partId)?.category === "window") ?? ground.find((p) => getPart(p.partId)?.category === "door");
    const upper = name.toUpperCase();
    for (const [pattern, kind] of BY_TEXT) if (pattern.test(upper)) add(kind, spot?.x ?? 0, 0);
  }
  return gags;
}
