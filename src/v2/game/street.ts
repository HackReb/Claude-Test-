import { itemIncomePerHour } from "./figure";
import { hashString, seededRandom } from "../../game/random";
import { randomFacade } from "../../game/randomBuilding";
import type { Facade, PlotSize } from "../../model/types";
import { ECONOMY2, GROWTH, MALL } from "../config/growth";
import { FALLBACK_SHOP, shopType, SHOP_TYPES, type ShopGroup } from "../config/shops";
import type { HouseStage, Lot, MemberData, Shop, StreetV2 } from "../model/types";

const HOUR = 3_600_000;

/** Welche Ladengruppen in der Mall vertreten sind. */
export function groupsOf(shops: Shop[]): Set<ShopGroup> {
  return new Set(shops.map((s) => (shopType(s.type) ?? FALLBACK_SHOP).group));
}

/** Anziehungskraft der Straße (0–1): je mehr Angebot und Mitspieler, desto mehr Leute wollen hier wohnen. */
export function attractionOf(street: Pick<StreetV2, "shops" | "members">): number {
  const value =
    GROWTH.baseAttraction + groupsOf(street.shops).size * GROWTH.perGroup + street.shops.length * GROWTH.perShop + street.members.length * GROWTH.perMember;
  return Math.min(1, value);
}

/** Alle Bauplätze in Wachstumsreihenfolge: erst die neben der Mall, dann gegenüber, von der Mitte nach außen. */
export function lotOrder(): { row: "top" | "bottom"; index: number }[] {
  const order: { row: "top" | "bottom"; index: number }[] = [];
  const top = GROWTH.lotsBesideMall;
  const bottom = GROWTH.lotsOpposite;
  // oben: Index 0..top-1 links (innen = top-1), top..2top-1 rechts (innen = top)
  const topInnerFirst = [...Array(top).keys()].flatMap((d) => [top - 1 - d, top + d]);
  const mid = Math.floor(bottom / 2);
  const bottomMidFirst = [...Array(bottom).keys()].map((i) => (i % 2 === 0 ? mid + Math.ceil(i / 2) : mid - Math.ceil(i / 2))).filter((i) => i >= 0 && i < bottom);
  // abwechselnd oben und unten, damit beide Seiten wachsen
  const topQ = topInnerFirst.map((index) => ({ row: "top" as const, index }));
  const bottomQ = bottomMidFirst.map((index) => ({ row: "bottom" as const, index }));
  while (topQ.length || bottomQ.length) {
    if (bottomQ.length) order.push(bottomQ.shift()!);
    if (topQ.length) order.push(topQ.shift()!);
    if (bottomQ.length) order.push(bottomQ.shift()!);
  }
  return order;
}

/** Haus-Stufe eines Bauplatzes: Anziehungskraft entscheidet, wie groß; die Zeit seit der Gründung bremst. */
export function stageOf(rank: number, total: number, attraction: number, minutesSinceFounded: number): HouseStage {
  const threshold = rank / total;
  if (attraction < threshold) return 0;
  const headroom = Math.max(0.0001, 1 - threshold);
  const byAttraction = 1 + Math.floor(((attraction - threshold) / headroom) * GROWTH.stagesPerAttraction);
  const byTime = 1 + Math.floor(Math.max(0, minutesSinceFounded) / GROWTH.minutesPerStage);
  return Math.min(4, byAttraction, byTime) as HouseStage;
}

export function occupancyOf(attraction: number): number {
  return Math.min(1, GROWTH.baseOccupancy + (1 - GROWTH.baseOccupancy) * attraction);
}

/** Die Straße jetzt: jeder Bauplatz mit Haus-Stufe und Bewohnern. Gleiche Eingaben = gleiches Bild bei allen Spielern. */
export function lotsOf(street: StreetV2, now: number): Lot[] {
  const attraction = attractionOf(street);
  const minutes = (now - street.foundedAt) / 60_000;
  const order = lotOrder();
  const occupancy = occupancyOf(attraction);
  return order.map((slot, rank) => {
    const stage = stageOf(rank, order.length, attraction, minutes);
    return {
      id: `${slot.row}-${slot.index}`,
      row: slot.row,
      index: slot.index,
      stage,
      residents: Math.round(GROWTH.capacity[stage] * occupancy * 10) / 10,
    };
  });
}

export const residentsOf = (lots: Lot[]) => lots.reduce((sum, l) => sum + l.residents, 0);

/** Fassade eines gewachsenen Hauses – fest je Straße, Bauplatz und Stufe (sieht bei allen gleich aus). */
export function houseFacade(streetId: string, lot: Lot): { facade: Facade; size: PlotSize } | null {
  if (lot.stage < 2) return null;
  const size: PlotSize = lot.stage === 2 ? "S" : lot.stage === 3 ? "M" : "L";
  const random = seededRandom(hashString(`v2:${streetId}:${lot.id}:${lot.stage}`));
  const facade = randomFacade(size, random, { use: "residential" });
  return { facade: { ...facade, floors: Math.min(facade.floors, lot.stage - 1) as 1 | 2 | 3 }, size };
}

export function mallFloors(shops: Shop[]): number {
  return Math.min(MALL.maxFloors, Math.max(1, Math.ceil(shops.length / MALL.shopsPerFloor)));
}

/** Umsatz eines Ladens pro Stunde: Laufkundschaft plus Bewohner – geteilt mit Läden desselben Typs. */
export function shopIncomePerHour(shop: Shop, street: StreetV2, residents: number): number {
  const sameType = street.shops.filter((s) => s.type === shop.type).length || 1;
  return ECONOMY2.walkInPerHour + (residents * ECONOMY2.perResidentPerHour) / sameType + itemIncomePerHour(shop, residents);
}

/** Was in den Kassen meiner Läden liegt (seit dem letzten Einsammeln, höchstens maxOfflineHours). */
export function pendingOf(member: { id: string; data: Partial<MemberData>; joinedAt: number }, street: StreetV2, now: number): number {
  const lots = lotsOf(street, now);
  const residents = residentsOf(lots);
  const since = member.data.collectedAt ?? member.joinedAt;
  let total = 0;
  for (const shop of street.shops) {
    if (shop.memberId !== member.id) continue;
    const from = Math.max(since, shop.openedAt, now - ECONOMY2.maxOfflineHours * HOUR);
    const hours = Math.max(0, (now - from) / HOUR);
    total += shopIncomePerHour(shop, street, residents) * hours;
  }
  return total;
}

export function openCostFor(ownShops: number): number {
  return ECONOMY2.openCost[Math.min(ownShops, ECONOMY2.openCost.length - 1)];
}

export const ALL_SHOP_IDS = SHOP_TYPES.map((t) => t.id);
