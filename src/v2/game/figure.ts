import { hashString, seededRandom } from "../../game/random";
import { HAIR_COLORS, INVENT, SKINS, SLOT_ORDER, type ItemDesign, type Slot } from "../config/items";
import type { Figure, Member, MemberSummary, OwnedItem, Shop, ShopItem, StreetV2, WornItem } from "../model/types";

/** Grund-Teile, die jeder hat (kostenlos) – damit niemand nackt herumläuft. */
export const STARTER_ITEMS: { id: string; name: string; design: ItemDesign }[] = [
  { id: "starter:shirt-blue", name: "Blaues Shirt", design: { slot: "top", shape: "shirt", colors: ["#1982c4", "#ffffff", "#ffd166"], pattern: "plain" } },
  { id: "starter:shirt-red", name: "Rotes Shirt", design: { slot: "top", shape: "shirt", colors: ["#ef476f", "#ffffff", "#ffd166"], pattern: "plain" } },
  { id: "starter:shirt-green", name: "Grünes Shirt", design: { slot: "top", shape: "shirt", colors: ["#06d6a0", "#ffffff", "#ffd166"], pattern: "plain" } },
  { id: "starter:hoodie", name: "Grauer Hoodie", design: { slot: "top", shape: "hoodie", colors: ["#8d99ae", "#2b2118", "#ffd166"], pattern: "plain" } },
  { id: "starter:pants", name: "Jeans", design: { slot: "legs", shape: "pants", colors: ["#1d3557", "#ffffff", "#ffd166"], pattern: "plain" } },
  { id: "starter:shorts", name: "Shorts", design: { slot: "legs", shape: "shorts", colors: ["#e9d8a6", "#ffffff", "#ffd166"], pattern: "plain" } },
  { id: "starter:sneakers", name: "Turnschuhe", design: { slot: "feet", shape: "sneakers", colors: ["#ffffff", "#e63946", "#2b2118"], pattern: "plain" } },
  { id: "starter:cap", name: "Kappe", design: { slot: "hat", shape: "cap", colors: ["#e63946", "#ffffff", "#ffd166"], pattern: "plain" } },
];

const starter = (id: string): WornItem => {
  const s = STARTER_ITEMS.find((i) => i.id === id)!;
  return { id: s.id, name: s.name, design: s.design };
};

/** Womit jeder anfängt, bis er sich selbst anzieht. */
export function defaultWorn(seed: string): Figure["worn"] {
  const random = seededRandom(hashString(`worn:${seed}`));
  const tops = STARTER_ITEMS.filter((i) => i.design.slot === "top");
  return { top: starter(tops[Math.floor(random() * tops.length)].id), legs: starter("starter:pants"), feet: starter("starter:sneakers") };
}

/** Figur eines Spielers – fehlt sie noch, wird eine feste zufällige aus der ID gewürfelt. */
export function figureOf(member: Pick<MemberSummary, "id" | "figure">): Figure {
  if (member.figure) return { base: { ...defaultBase(member.id), ...member.figure.base }, worn: { ...member.figure.worn } };
  return { base: defaultBase(member.id), worn: defaultWorn(member.id) };
}

export function defaultBase(seed: string): Figure["base"] {
  const random = seededRandom(hashString(`figure:${seed}`));
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  return { skin: pick(SKINS), hair: pick(HAIR_COLORS), hairStyle: pick(["short", "long", "curly", "bun", "spiky"] as const) };
}

/** Eine Ware (Grund-Teil oder gekauft) zu ihrer ID. */
export function resolveItem(id: string, inventory: OwnedItem[] = []): WornItem | null {
  const s = STARTER_ITEMS.find((i) => i.id === id);
  if (s) return starter(id);
  const owned = inventory.find((o) => o.id === id);
  return owned ? { id: owned.id, name: owned.name, design: owned.design, shopId: owned.shopId, shopName: owned.shopName } : null;
}

/** Was die Figur gerade trägt, als Designs je Platz (kaputte Einträge werden ignoriert). */
export function wornDesigns(figure: Figure): Partial<Record<Slot, ItemDesign>> {
  const result: Partial<Record<Slot, ItemDesign>> = {};
  for (const [slot, item] of Object.entries(figure.worn) as [Slot, WornItem | undefined][]) {
    if (item?.design && item.design.slot === slot && Array.isArray(item.design.colors)) result[slot] = item.design;
  }
  return result;
}

/** Alles, was jemand tragen kann: Grund-Teile plus gekaufte Waren, nach Platz. */
export function wardrobe(inventory: OwnedItem[] = []): Record<Slot, WornItem[]> {
  const result = { hat: [], face: [], top: [], legs: [], feet: [], hand: [], back: [], pet: [], ride: [] } as Record<Slot, WornItem[]>;
  for (const s of STARTER_ITEMS) result[s.design.slot].push(starter(s.id));
  for (const o of inventory) if (o.design && result[o.design.slot]) result[o.design.slot].push({ id: o.id, name: o.name, design: o.design, shopId: o.shopId, shopName: o.shopName });
  return result;
}

/** Was ein Mitglied trägt, als Liste für die Spieler-Karte (in fester Reihenfolge der Plätze). */
export function outfitOf(member: Pick<MemberSummary, "id" | "figure">): ({ slot: Slot } & WornItem)[] {
  const figure = figureOf(member);
  return SLOT_ORDER.flatMap((slot) => (figure.worn[slot] ? [{ slot, ...figure.worn[slot]! }] : []));
}

/** Figur mit einem Stück an-/ausgezogen. */
export function wear(figure: Figure, slot: Slot, item: WornItem | null): Figure {
  const worn = { ...figure.worn };
  if (item) worn[slot] = item;
  else delete worn[slot];
  return { ...figure, worn };
}

/** Alle Waren, die in der Mall im Schaufenster liegen. */
export function showcaseOf(street: Pick<StreetV2, "shops">): { shop: Shop; item: ShopItem }[] {
  return street.shops.flatMap((shop) => (shop.data.items ?? []).filter((i) => i.showcase).map((item) => ({ shop, item })));
}

/**
 * Was ein Bewohner trägt: ein festes Stück aus dem Schaufenster der Mall (oder nichts). Je mehr
 * ausgestellt ist, desto mehr Leute laufen damit herum – und jeder sieht dieselbe Zuordnung.
 */
export function residentPick(npcId: string, showcase: { shop: Shop; item: ShopItem }[]): { shop: Shop; item: ShopItem } | null {
  if (showcase.length === 0) return null;
  const random = seededRandom(hashString(`wear:${npcId}`));
  // Mit 1–2 Waren trägt jeder Dritte etwas, bei vielen fast jeder.
  const chance = Math.min(0.85, 0.25 + showcase.length * 0.1);
  if (random() > chance) return null;
  // Günstige Waren werden öfter gekauft.
  const weights = showcase.map(({ item }) => 1 / Math.sqrt(Math.max(10, item.price)));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < showcase.length; i++) {
    r -= weights[i];
    if (r < 0) return showcase[i];
  }
  return showcase[showcase.length - 1];
}

/**
 * Verkäufe an Bewohner je Stunde für eine Ware im Schaufenster: viele Bewohner helfen, günstige Waren
 * gehen öfter weg. Der Umsatz (Stück × Preis) steigt mit dem Preis, aber nie über 1,5 Münzen je Bewohner.
 */
export function residentSalesPerHour(item: ShopItem, residents: number): number {
  return (residents * 0.01) / (1 + Math.max(10, item.price) / 150);
}

/** Umsatz pro Stunde durch Bewohner, die Waren kaufen (zusätzlich zur Laufkundschaft). */
export function itemIncomePerHour(shop: Shop, residents: number): number {
  return (shop.data.items ?? []).filter((i) => i.showcase).reduce((sum, item) => sum + residentSalesPerHour(item, residents) * item.price, 0);
}

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Wie oft darf man heute noch erfinden? */
export function inventionsLeft(member: Pick<Member, "data">, now: number): number {
  const invented = member.data.invented;
  const today = dayKey(now);
  return INVENT.perDay - (invented && invented.day === today ? invented.count : 0);
}
