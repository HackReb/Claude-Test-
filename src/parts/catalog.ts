import { ECONOMY } from "../config/economy";
import type { Part, PartCategory } from "../model/types";

// Bausteine: `svg` ist Inline-Markup in einem festen Koordinatensystem je Kategorie
// (siehe FACADE_GRID). Start-Set für M2 – in M3 kommen ~15 weitere Teile dazu.

export const PARTS: Part[] = [
  {
    id: "base-brick",
    category: "base",
    price: 0,
    rentBonus: 0,
    svg: `<rect width="40" height="50" fill="#e07a5f"/><path d="M0 12.5h40M0 25h40M0 37.5h40M20 0v12.5M10 12.5v12.5M30 12.5v12.5M20 25v12.5M10 37.5v12.5M30 37.5v12.5" stroke="#b5533c" stroke-width="1.5"/>`,
  },
  {
    id: "roof-flat",
    category: "roof",
    price: 0,
    rentBonus: 0,
    svg: `<rect y="12" width="100" height="18" fill="#6d597a" stroke="#2b2118" stroke-width="3" vector-effect="non-scaling-stroke"/>`,
  },
  {
    id: "door-shop",
    category: "door",
    price: 0,
    rentBonus: 0,
    svg: `<rect x="10" y="17" width="20" height="33" rx="3" fill="#8d5a3b" stroke="#2b2118" stroke-width="2.5"/><circle cx="25" cy="34" r="2" fill="#ffd166"/>`,
  },
  {
    id: "window-square",
    category: "window",
    price: 0,
    rentBonus: 0,
    svg: `<rect x="8" y="16" width="24" height="22" rx="2" fill="#bde0fe" stroke="#2b2118" stroke-width="2.5"/><path d="M20 16v22M8 27h24" stroke="#2b2118" stroke-width="2"/>`,
  },
  {
    id: "deco-sign",
    category: "deco",
    price: 0,
    rentBonus: ECONOMY.decoRentBonus,
    svg: `<rect x="1" y="1" width="38" height="14" rx="3" fill="#ffd166" stroke="#2b2118" stroke-width="2"/>`,
  },
];

const byId = new Map(PARTS.map((p) => [p.id, p]));

export function getPart(id: string): Part | undefined {
  return byId.get(id);
}

export function partsOf(category: PartCategory): Part[] {
  return PARTS.filter((p) => p.category === category);
}
