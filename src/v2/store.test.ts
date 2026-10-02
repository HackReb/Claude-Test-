import { describe, expect, it, vi } from "vitest";
import type { V2Api } from "./api";
import type { Member, OwnedItem, Shop, StreetV2, V2State } from "./model/types";
import { createV2Store } from "./store";

const account = { id: "a1", name: "Kalle" };
const item = { id: "w1", name: "Krone", description: "", design: { slot: "hat" as const, shape: "crown", colors: ["#f00", "#fff", "#000"] as [string, string, string], pattern: "plain" as const }, price: 300, showcase: true, createdAt: 0, sold: 0 };
const shop = (memberId: string): Shop => ({ id: "s1", memberId, type: "hutmacher", name: "Kronen", look: 0, openedAt: 0, data: { items: [item] } });

function fakeApi(member: Member, street: StreetV2) {
  const server = { member: structuredClone(member), street: structuredClone(street) };
  const api = {
    signedIn: true,
    forgetIfSignedOut: () => false,
    me: vi.fn(async (): Promise<V2State> => ({ account, member: structuredClone(server.member), street: structuredClone(server.street) })),
    save: vi.fn(async (data: Member["data"]) => {
      server.member.data = structuredClone(data);
    }),
    updateShop: vi.fn(async (id: string, patch: { data?: Record<string, unknown> }) => {
      const s = server.street.shops.find((x) => x.id === id)!;
      s.data = { ...s.data, ...patch.data } as Shop["data"];
      return { shop: structuredClone(s) };
    }),
    buy: vi.fn(async (shopId: string, itemId: string) => {
      const s = server.street.shops.find((x) => x.id === shopId)!;
      const it = s.data.items!.find((x) => x.id === itemId)!;
      it.sold++;
      server.member.data.coins = (server.member.data.coins ?? 0) - it.price;
      const bought: OwnedItem = { id: "o1", itemId, shopId, shopName: s.name, name: it.name, design: it.design, price: it.price, boughtAt: 1 };
      server.member.data.inventory = [...(server.member.data.inventory ?? []), bought];
      return { account, member: structuredClone(server.member), street: structuredClone(server.street), bought, shop: structuredClone(s) };
    }),
  };
  return { api: api as unknown as V2Api, server };
}

const streetOf = (shops: Shop[]): StreetV2 => ({ id: "st", name: "Bahnhofstraße", city: "X", osm: null, founderAccountId: "a1", foundedAt: 0, maxMembers: 50, members: [{ id: "m1", name: "Kalle", joinedAt: 0 }], shops });

describe("v2 Store: Waren", () => {
  it("Verkäufe an Mitspieler kommen beim Aktualisieren obendrauf und gehen beim Speichern nicht verloren", async () => {
    const member: Member = { id: "m1", name: "Kalle", joinedAt: 0, data: { coins: 1000, collectedAt: 0 } };
    const { api, server } = fakeApi(member, streetOf([shop("m1")]));
    const store = createV2Store(api);
    await store.getState().init();
    expect(store.getState().coins()).toBe(1000);
    // Jemand kauft für 300 – der Server schreibt es gut, während ich online bin.
    server.member.data.coins = 1300;
    server.member.data.sales = 1;
    await store.getState().refresh();
    expect(store.getState().coins()).toBe(1300);
    // Nochmal aktualisieren ohne neue Verkäufe: nichts doppelt.
    await store.getState().refresh();
    expect(store.getState().coins()).toBe(1300);
    // Figur speichern schickt die 1300 mit, nicht die alten 1000.
    await store.getState().saveFigure({ base: { skin: "#fff", hair: "#000", hairStyle: "short" }, worn: {} });
    expect(server.member.data.coins).toBe(1300);
    expect(server.member.data.figure?.base.skin).toBe("#fff");
    expect(store.getState().street?.members[0].figure?.base.skin).toBe("#fff");
  });

  it("Erfinden kostet Münzen, zählt je Tag und legt die Ware in den Laden", async () => {
    const member: Member = { id: "m1", name: "Kalle", joinedAt: 0, data: { coins: 120, collectedAt: 0 } };
    const { api, server } = fakeApi(member, streetOf([{ ...shop("m1"), data: { items: [] } }]));
    const store = createV2Store(api);
    await store.getState().init();
    const first = await store.getState().invent("s1", { name: "Punkte-Dino", description: "grün-blau gepunkteter Dino", slot: "pet", price: 99999 });
    expect(first.ok).toBe(true);
    expect(first.item).toMatchObject({ name: "Punkte-Dino", price: 5000, showcase: true, design: { shape: "dino", pattern: "dots" } });
    expect(store.getState().coins()).toBe(70);
    expect(store.getState().member?.data.invented?.count).toBe(1);
    expect(server.street.shops[0].data.items).toHaveLength(1);
    const second = await store.getState().invent("s1", { name: "Noch einer", description: "rot", slot: "pet", price: 10 });
    expect(second.ok).toBe(true);
    const third = await store.getState().invent("s1", { name: "Pleite", description: "blau", slot: "pet", price: 10 });
    expect(third).toMatchObject({ ok: false });
    expect(store.getState().coins()).toBe(20);
  });

  it("Kaufen: erst Spielstand sichern, dann kauft der Server und die Ware liegt im Schrank", async () => {
    const member: Member = { id: "m2", name: "Zoe", joinedAt: 0, data: { coins: 500, collectedAt: 0 } };
    const { api, server } = fakeApi(member, streetOf([shop("m1")]));
    const store = createV2Store(api);
    await store.getState().init();
    const result = await store.getState().buy("s1", "w1");
    expect(result.ok).toBe(true);
    expect(result.bought?.name).toBe("Krone");
    expect(store.getState().coins()).toBe(200);
    expect(store.getState().member?.data.inventory).toHaveLength(1);
    expect(store.getState().street?.shops[0].data.items?.[0].sold).toBe(1);
    expect(server.member.data.coins).toBe(200);
    const again = await store.getState().buy("s1", "w1");
    expect(again).toMatchObject({ ok: false, message: expect.stringContaining("fehlen") });
  });
});
