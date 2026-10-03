import { FALLBACK_SHOP, shopType } from "../config/shops";
import type { NewsEvent, Shop, ShopItem, StreetV2 } from "../model/types";
import { residentSalesPerHour } from "./figure";

/** „vor 3 Min.“, „vor 2 Std.“, „gestern“ … */
export function agoText(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days === 1) return "gestern";
  if (days < 14) return `vor ${days} Tagen`;
  return new Date(at).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

/** Die Schlagzeile zu einem Ereignis (das Symbol kommt vom Ladentyp oder der Art). */
export function headline(event: NewsEvent): { icon: string; text: string } {
  const d = event.data;
  const who = d.who ?? "Jemand";
  const shop = d.shopName ?? "einem Laden";
  const emoji = d.type ? (shopType(d.type) ?? FALLBACK_SHOP).emoji : "🏬";
  switch (event.kind) {
    case "join":
      return { icon: "🎉", text: `${who} ist in die Straße gezogen.` };
    case "leave":
      return { icon: "📦", text: `${who} ist weggezogen${d.shops ? ` – ${d.shops === 1 ? "ein Laden steht" : `${d.shops} Läden stehen`} leer` : ""}.` };
    case "shop":
      return { icon: emoji, text: `${who} hat „${shop}“ eröffnet.` };
    case "close":
      return { icon: "🚪", text: `${who} hat „${shop}“ geschlossen.` };
    case "item":
      return { icon: "🆕", text: `Neu bei ${shop}: ${d.item?.name ?? "eine Ware"} für 🪙 ${d.item?.price ?? "?"}.` };
    case "buy":
      return { icon: "🛍️", text: `${who}${d.visitor ? " (zu Besuch)" : ""} hat ${d.item?.name ?? "etwas"} bei ${shop} gekauft.` };
    default:
      return { icon: "📰", text: `${who} hat etwas gemacht.` };
  }
}

export interface Bestseller {
  shop: Shop;
  item: ShopItem;
  /** Verkäufe an Spieler plus geschätzte Verkäufe an Bewohner seit dem Erfinden. */
  sales: number;
}

/** Die meistverkauften Waren der Straße – Spieler-Käufe zählen voll, Bewohner-Käufe geschätzt. */
export function bestsellers(street: Pick<StreetV2, "shops">, residents: number, now: number, limit = 5): Bestseller[] {
  const list: Bestseller[] = [];
  for (const shop of street.shops) {
    for (const item of shop.data.items ?? []) {
      const hours = Math.max(0, (now - item.createdAt) / 3_600_000);
      const byResidents = item.showcase ? residentSalesPerHour(item, residents) * Math.min(hours, 72) : 0;
      list.push({ shop, item, sales: item.sold + byResidents });
    }
  }
  return list
    .filter((b) => b.sales >= 0.5)
    .sort((a, b) => b.sales - a.sales || b.item.sold - a.item.sold || a.item.createdAt - b.item.createdAt)
    .slice(0, limit);
}
