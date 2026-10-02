import { create } from "zustand";
import type { OsmStreetRef } from "../model/types";
import { messageOf, V2Api } from "./api";
import { ECONOMY2 } from "./config/growth";
import { openCostFor, pendingOf } from "./game/street";
import type { Member, Shop, StreetV2, V2Account } from "./model/types";

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
  coins(): number;
  pending(now?: number): number;
}

export function createV2Store(api: V2Api | null) {
  return create<V2Store>()((set, get) => {
    const apply = (state: { account: V2Account; member: Member | null; street: StreetV2 | null }) =>
      set({
        account: state.account,
        member: state.member ? { ...state.member, data: { coins: ECONOMY2.startCoins, ...state.member.data } } : null,
        street: state.street,
        status: state.member && state.street ? "ready" : "no-street",
        notice: null,
      });

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
          // Münzen bleiben die lokalen (der Server hat sie vielleicht noch nicht), die Straße kommt frisch.
          set({ account: state.account, street: state.street, status: state.member && state.street ? "ready" : "no-street" });
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
