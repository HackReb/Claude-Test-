import { create } from "zustand";
import type { OsmStreetRef } from "../model/types";
import { messageOf, V2Api } from "./api";
import { ECONOMY2 } from "./config/growth";
import { INVENT, type Slot } from "./config/items";
import { designFromText } from "./game/designer";
import { dayKey, inventionsLeft } from "./game/figure";
import { openCostFor, pendingOf } from "./game/street";
import type { Figure, Member, OwnedItem, Shop, ShopItem, StreetV2, V2Account } from "./model/types";

type Status = "loading" | "logged-out" | "no-street" | "ready" | "error" | "offline";
type Result = { ok: true } | { ok: false; message: string };

export interface V2Store {
  status: Status;
  account: V2Account | null;
  member: Member | null;
  street: StreetV2 | null;
  /** Letzte Fehlermeldung vom Server (z. B. Straße voll). */
  notice: string | null;

  init(): Promise<void>;
  login(name: string, password: string): Promise<Result>;
  register(name: string, password: string): Promise<Result>;
  logout(): Promise<void>;
  join(street: { name: string; city: string; osm?: OsmStreetRef }): Promise<Result>;
  leave(): Promise<void>;
  refresh(): Promise<void>;
  openShop(type: string, name: string, look: number): Promise<Result & { shop?: Shop }>;
  updateShop(id: string, patch: { name?: string; look?: number }): Promise<Result>;
  closeShop(id: string): Promise<Result>;
  /** Kassen leeren: Umsatz seit dem letzten Mal aufs Konto. */
  collect(): Promise<number>;
  /** Die eigene Figur anziehen/umbauen – sofort sichtbar, dann zum Server. */
  saveFigure(figure: Figure): Promise<void>;
  /** Eine neue Ware für den eigenen Laden erfinden (kostet Münzen, begrenzt je Tag). */
  invent(shopId: string, draft: { name: string; description: string; slot: Slot; price: number }): Promise<Result & { item?: ShopItem }>;
  /** Sortiment eines eigenen Ladens ändern (Preis, Schaufenster, löschen). */
  updateItems(shopId: string, items: ShopItem[]): Promise<Result>;
  /** Eine Ware aus einem fremden Schaufenster kaufen. */
  buy(shopId: string, itemId: string): Promise<Result & { bought?: OwnedItem }>;
  coins(): number;
  pending(now?: number): number;
}

export function createV2Store(api: V2Api | null) {
  return create<V2Store>()((set, get) => {
    /** Der Münzstand, den der Server zuletzt von uns kennt – alles darüber hinaus sind Verkäufe an Mitspieler. */
    let syncedCoins = 0;
    const apply = (state: { account: V2Account; member: Member | null; street: StreetV2 | null }) => {
      syncedCoins = state.member?.data.coins ?? ECONOMY2.startCoins;
      set({
        account: state.account,
        member: state.member ? { ...state.member, data: { coins: ECONOMY2.startCoins, ...state.member.data } } : null,
        street: state.street,
        status: state.member && state.street ? "ready" : "no-street",
        notice: null,
      });
    };

    async function load() {
      if (!api) return set({ status: "offline" });
      if (!api.signedIn) return set({ status: "logged-out", account: null, member: null, street: null });
      try {
        apply(await api.me());
      } catch (error) {
        if (api.forgetIfSignedOut(error)) set({ status: "logged-out", account: null, member: null, street: null });
        else set({ status: "error", notice: messageOf(error) });
      }
    }

    async function saveMember(data: Member["data"]) {
      const member = get().member;
      if (!member || !api) return;
      set({ member: { ...member, data } });
      syncedCoins = data.coins ?? syncedCoins;
      await api.save(data).catch((error) => console.warn("Spielstand nicht gespeichert", error));
    }

    return {
      status: "loading",
      account: null,
      member: null,
      street: null,
      notice: null,

      init: load,

      async login(name, password) {
        if (!api) return { ok: false, message: "Ohne Server geht es nicht." };
        try {
          await api.login(name, password);
          await load();
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async register(name, password) {
        if (!api) return { ok: false, message: "Ohne Server geht es nicht." };
        try {
          await api.register(name, password);
          await load();
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async logout() {
        await api?.logout();
        set({ status: "logged-out", account: null, member: null, street: null });
      },

      async join(street) {
        if (!api) return { ok: false, message: "Ohne Server geht es nicht." };
        try {
          apply(await api.join(street, { coins: ECONOMY2.startCoins, collectedAt: Date.now() }));
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async leave() {
        if (!api) return;
        apply(await api.leave());
      },

      async refresh() {
        if (!api || !get().member) return;
        try {
          const state = await api.me();
          // Die Straße kommt frisch. Meine Münzen bleiben die lokalen – außer der Server hat inzwischen
          // Verkäufe an Mitspieler gutgeschrieben: die kommen obendrauf (sonst würde der nächste Spielstand sie löschen).
          const local = get().member;
          const server = state.member;
          let member = local;
          if (local && server) {
            const delta = (server.data.coins ?? syncedCoins) - syncedCoins;
            syncedCoins = server.data.coins ?? syncedCoins;
            if (delta !== 0 || (server.data.sales ?? 0) !== (local.data.sales ?? 0))
              member = { ...local, data: { ...local.data, coins: (local.data.coins ?? 0) + delta, sales: server.data.sales } };
          }
          set({ account: state.account, member, street: state.street, status: state.member && state.street ? "ready" : "no-street" });
        } catch (error) {
          if (api.forgetIfSignedOut(error)) set({ status: "logged-out", account: null, member: null, street: null });
        }
      },

      async openShop(type, name, look) {
        const { member, street } = get();
        if (!api || !member || !street) return { ok: false, message: "Wähl zuerst deine Straße." };
        const own = street.shops.filter((s) => s.memberId === member.id).length;
        const cost = openCostFor(own);
        if (get().coins() < cost) return { ok: false, message: `Dafür brauchst du 🪙 ${cost}.` };
        try {
          const result = await api.openShop(type, name, look);
          apply(result);
          if (cost > 0) await saveMember({ ...get().member!.data, coins: get().coins() - cost });
          return { ok: true, shop: result.shop };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async updateShop(id, patch) {
        const street = get().street;
        if (!api || !street) return { ok: false, message: "Wähl zuerst deine Straße." };
        try {
          const { shop } = await api.updateShop(id, patch);
          set({ street: { ...street, shops: street.shops.map((s) => (s.id === id ? shop : s)) } });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async closeShop(id) {
        if (!api) return { ok: false, message: "Ohne Server geht es nicht." };
        try {
          apply(await api.closeShop(id));
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async collect() {
        const { member } = get();
        if (!member) return 0;
        const now = Date.now();
        const amount = Math.floor(get().pending(now));
        if (amount <= 0) return 0;
        await saveMember({ ...member.data, coins: get().coins() + amount, collectedAt: now });
        return amount;
      },

      async saveFigure(figure) {
        const member = get().member;
        if (!member) return;
        await saveMember({ ...member.data, figure });
        // Auch die Mitgliederliste der Straße kennt meine Figur – sonst läuft die alte herum.
        const street = get().street;
        if (street) set({ street: { ...street, members: street.members.map((m) => (m.id === member.id ? { ...m, figure } : m)) } });
      },

      async invent(shopId, draft) {
        const { member, street } = get();
        if (!api || !member || !street) return { ok: false, message: "Wähl zuerst deine Straße." };
        const shop = street.shops.find((s) => s.id === shopId);
        if (!shop || shop.memberId !== member.id) return { ok: false, message: "Das ist nicht dein Laden." };
        const items = shop.data.items ?? [];
        if (items.length >= INVENT.itemsPerShop) return { ok: false, message: `Mehr als ${INVENT.itemsPerShop} Waren passen nicht in einen Laden.` };
        const now = Date.now();
        if (inventionsLeft(member, now) <= 0) return { ok: false, message: `Heute hast du schon ${INVENT.perDay} Waren erfunden – morgen geht es weiter.` };
        if (get().coins() < INVENT.cost) return { ok: false, message: `Erfinden kostet 🪙 ${INVENT.cost}.` };
        const name = draft.name.trim();
        if (name.length < 2) return { ok: false, message: "Gib der Ware einen Namen." };
        const item: ShopItem = {
          id: `w${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          name: name.slice(0, 24),
          description: draft.description.trim().slice(0, INVENT.descriptionMax),
          design: designFromText(draft.description, draft.slot),
          price: Math.min(INVENT.priceMax, Math.max(INVENT.priceMin, Math.round(draft.price) || INVENT.priceDefault)),
          showcase: items.filter((i) => i.showcase).length < INVENT.showcasePerShop,
          createdAt: now,
          sold: 0,
        };
        const result = await get().updateItems(shopId, [...items, item]);
        if (!result.ok) return result;
        const day = dayKey(now);
        const invented = member.data.invented?.day === day ? member.data.invented.count + 1 : 1;
        await saveMember({ ...get().member!.data, coins: get().coins() - INVENT.cost, invented: { day, count: invented } });
        return { ok: true, item };
      },

      async updateItems(shopId, items) {
        const street = get().street;
        if (!api || !street) return { ok: false, message: "Wähl zuerst deine Straße." };
        try {
          const { shop } = await api.updateShop(shopId, { data: { ...street.shops.find((s) => s.id === shopId)?.data, items } });
          set({ street: { ...get().street!, shops: get().street!.shops.map((s) => (s.id === shopId ? shop : s)) } });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      },

      async buy(shopId, itemId) {
        const { member, street } = get();
        if (!api || !member || !street) return { ok: false, message: "Wähl zuerst deine Straße." };
        const shop = street.shops.find((s) => s.id === shopId);
        const item = shop?.data.items?.find((i) => i.id === itemId);
        if (!shop || !item) return { ok: false, message: "Diese Ware gibt es nicht mehr." };
        if (get().coins() < item.price) return { ok: false, message: `Dafür fehlen dir 🪙 ${item.price - get().coins()}.` };
        try {
          // Der Server rechnet mit seinem Stand – also erst meine Münzen hinschicken.
          await api.save(member.data);
          const result = await api.buy(shopId, itemId);
          apply(result);
          set({ street: { ...get().street!, shops: get().street!.shops.map((s) => (s.id === shopId ? result.shop : s)) } });
          return { ok: true, bought: result.bought };
        } catch (error) {
          await get().refresh();
          return { ok: false, message: messageOf(error) };
        }
      },

      coins() {
        return get().member?.data.coins ?? 0;
      },

      pending(now = Date.now()) {
        const { member, street } = get();
        return member && street ? pendingOf(member, street, now) : 0;
      },
    };
  });
}

function defaultApi(): V2Api | null {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? new V2Api(apiUrl) : null;
}

export const useV2 = createV2Store(defaultApi());
