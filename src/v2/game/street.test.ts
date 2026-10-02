import { describe, expect, it } from "vitest";
import { GROWTH } from "../config/growth";
import { SHOP_TYPES } from "../config/shops";
import type { Shop, StreetV2 } from "../model/types";
import { attractionOf, houseFacade, lotOrder, lotsOf, mallFloors, openCostFor, pendingOf, residentsOf, stageOf } from "./street";

const HOUR = 3_600_000;
const shop = (id: string, type: string, memberId = "m1", openedAt = 0): Shop => ({ id, memberId, type, name: id, look: 0, openedAt, data: {} });
const street = (shops: Shop[], members = 1, foundedAt = 0): StreetV2 => ({
  id: "s1",
  name: "Bahnhofstraße",
  city: "Tuttlingen",
  osm: null,
  founderAccountId: "a1",
  foundedAt,
  maxMembers: 50,
  members: Array.from({ length: members }, (_, i) => ({ id: `m${i + 1}`, name: `Spieler ${i + 1}`, joinedAt: 0 })),
  shops,
});

describe("Straße wächst von allein", () => {
  it("jeder Bauplatz kommt genau einmal dran, die neben der Mall und in der Mitte zuerst", () => {
    const order = lotOrder();
    expect(order).toHaveLength(GROWTH.lotsBesideMall * 2 + GROWTH.lotsOpposite);
    expect(new Set(order.map((o) => `${o.row}-${o.index}`)).size).toBe(order.length);
    expect(order[0]).toEqual({ row: "bottom", index: 3 });
    expect(order[1]).toEqual({ row: "top", index: 2 });
  });

  it("mehr Angebot und mehr Mitspieler = mehr Anziehung, nie über 1", () => {
    const empty = attractionOf(street([]));
    const one = attractionOf(street([shop("a", "baeckerei")]));
    const two = attractionOf(street([shop("a", "baeckerei"), shop("b", "tierhandlung")], 5));
    expect(one).toBeGreaterThan(empty);
    expect(two).toBeGreaterThan(one);
    expect(attractionOf(street(SHOP_TYPES.map((t) => shop(t.id, t.id)), 50))).toBe(1);
  });

  it("Häuser wachsen mit Anziehung und Zeit – eine leere Straße bleibt fast leer", () => {
    expect(stageOf(0, 13, 0.2, 10_000)).toBe(2);
    expect(stageOf(12, 13, 0.2, 10_000)).toBe(0);
    expect(stageOf(12, 13, 1, 10_000)).toBe(4);
    // Zeit bremst: direkt nach der Gründung höchstens eine Baustelle
    expect(stageOf(0, 13, 0.9, 0)).toBe(1);
    expect(stageOf(0, 13, 0.9, GROWTH.minutesPerStage * 3)).toBe(4);
  });

  it("volle Straße: viele Bewohner, Fassaden fest je Bauplatz", () => {
    const full = street(SHOP_TYPES.slice(0, 12).map((t) => shop(t.id, t.id)), 30, 0);
    const lots = lotsOf(full, 5 * HOUR);
    expect(lots.every((l) => l.stage === 4)).toBe(true);
    expect(residentsOf(lots)).toBeGreaterThan(200);
    const a = houseFacade("s1", lots[0])!;
    const b = houseFacade("s1", lots[0])!;
    expect(a).toEqual(b);
    expect(a.size).toBe("L");
    expect(houseFacade("s1", { ...lots[0], stage: 1 })).toBeNull();
  });

  it("Mall-Stockwerke und Eröffnungskosten", () => {
    expect(mallFloors([])).toBe(1);
    expect(mallFloors(Array.from({ length: 5 }, (_, i) => shop(`s${i}`, "kiosk")))).toBe(2);
    expect(openCostFor(0)).toBe(0);
    expect(openCostFor(1)).toBe(1500);
    expect(openCostFor(2)).toBe(4000);
  });

  it("Kasse: Umsatz seit dem letzten Einsammeln, geteilt mit gleichen Läden, höchstens 72 Stunden", () => {
    const s = street([shop("a", "baeckerei", "m1"), shop("b", "baeckerei", "m2"), shop("c", "kiosk", "m1")], 2, 0);
    const member = { id: "m1", joinedAt: 0, data: {} };
    const oneHour = pendingOf(member, s, HOUR);
    expect(oneHour).toBeGreaterThan(0);
    const twoHours = pendingOf(member, s, 2 * HOUR);
    expect(twoHours).toBeGreaterThan(oneHour);
    expect(pendingOf({ ...member, data: { collectedAt: 2 * HOUR } }, s, 2 * HOUR)).toBe(0);
    const capped = pendingOf(member, s, 1000 * HOUR);
    expect(capped).toBeLessThan(pendingOf(member, s, 72 * HOUR) * 1.01 + 1);
  });
});
