import { describe, expect, it } from "vitest";
import type { NewsEvent, Shop, ShopItem } from "../model/types";
import { agoText, bestsellers, headline } from "./news";

const item = (id: string, sold: number, price: number, createdAt: number, showcase = true): ShopItem => ({
  id,
  name: id,
  description: "",
  design: { slot: "hat", shape: "cap", colors: ["#f00", "#fff", "#000"], pattern: "plain" },
  price,
  showcase,
  createdAt,
  sold,
});
const shop = (id: string, items: ShopItem[]): Shop => ({ id, memberId: "m1", type: "hutmacher", name: id, look: 0, openedAt: 0, data: { items } });

describe("Zeitung", () => {
  it("sagt, wie lange etwas her ist", () => {
    const now = Date.UTC(2026, 9, 2, 12);
    expect(agoText(now - 20_000, now)).toBe("gerade eben");
    expect(agoText(now - 5 * 60_000, now)).toBe("vor 5 Min.");
    expect(agoText(now - 3 * 3_600_000, now)).toBe("vor 3 Std.");
    expect(agoText(now - 26 * 3_600_000, now)).toBe("gestern");
    expect(agoText(now - 4 * 86_400_000, now)).toBe("vor 4 Tagen");
  });

  it("macht Schlagzeilen aus Ereignissen", () => {
    const ev = (kind: NewsEvent["kind"], data: NewsEvent["data"]): NewsEvent => ({ id: "e", kind, memberId: "m", at: 0, data });
    expect(headline(ev("join", { who: "Zoe" })).text).toBe("Zoe ist in die Straße gezogen.");
    expect(headline(ev("shop", { who: "Kalle", shopName: "Dino & Co", type: "fabelzoo" }))).toEqual({ icon: "🦄", text: "Kalle hat „Dino & Co“ eröffnet." });
    expect(headline(ev("item", { who: "Kalle", shopName: "Dino & Co", item: { id: "w", name: "Punkte-Dino", price: 300, design: null } })).text).toBe("Neu bei Dino & Co: Punkte-Dino für 🪙 300.");
    expect(headline(ev("buy", { who: "Zoe", visitor: true, shopName: "Dino & Co", item: { id: "w", name: "Punkte-Dino", price: 300, design: null } })).text).toBe("Zoe (zu Besuch) hat Punkte-Dino bei Dino & Co gekauft.");
    expect(headline(ev("leave", { who: "Zoe", shops: 2 })).text).toBe("Zoe ist weggezogen – 2 Läden stehen leer.");
  });

  it("Bestseller: Spieler-Käufe zählen voll, Bewohner-Käufe geschätzt, Ladenhüter fehlen", () => {
    const now = 100 * 3_600_000;
    const street = { shops: [shop("s1", [item("hit", 25, 100, 0), item("new", 0, 100, now), item("cheap", 0, 10, 0), item("hidden", 0, 10, 0, false)])] };
    const top = bestsellers(street, 30, now);
    expect(top[0].item.id).toBe("hit");
    expect(top.map((b) => b.item.id)).toContain("cheap");
    expect(top.map((b) => b.item.id)).not.toContain("new");
    expect(top.map((b) => b.item.id)).not.toContain("hidden");
    expect(bestsellers({ shops: [] }, 30, now)).toEqual([]);
  });
});
