import { ECONOMY } from "../config/economy";
import type { Part, PartCategory, PartMount } from "../model/types";

// Bausteine als Inline-SVG. Koordinatensysteme (siehe FACADE_GRID):
// - base/door/window/deco: eine Zelle 40×50, Unterkante y=50 = Boden bzw. Dachansatz (bei mount "roof")
// - roof: 100×40, wird auf die Fassadenbreite gestreckt → Konturen mit non-scaling-stroke
// Teile dürfen über ihre Zelle hinausragen (Palmwedel, Fahnenmasten).
// `price` 0 = Start-Set, sonst Freischalt-Preis in Münzen (Geldsenke, Konzept 6.3).

const INK = "#2b2118";
const OUTLINE = `stroke="${INK}" vector-effect="non-scaling-stroke"`;
const DECO = ECONOMY.decoRentBonus;

const gummyBear = (x: number, y: number, fill: string) =>
  `<g transform="translate(${x} ${y})" fill="${fill}"><circle cx="6.5" cy="3.5" r="2.2"/><circle cx="13.5" cy="3.5" r="2.2"/><circle cx="10" cy="7" r="4.2"/><ellipse cx="10" cy="17" rx="6" ry="7.5"/><circle cx="8" cy="6" r="1.1" fill="#fff" opacity=".8"/></g>`;

const candyCane = (x: number) =>
  `<rect x="${x - 2.5}" y="31" width="5" height="19" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 2.5} 36l5-3M${x - 2.5} 42l5-3M${x - 2.5} 48l5-3" stroke="#e63946" stroke-width="2"/><path d="M${x + 2.5} 31q0-6-5-6" fill="none" stroke="#e63946" stroke-width="3" stroke-linecap="round"/>`;

type PartInput = Omit<Part, "price" | "rentBonus"> & Partial<Pick<Part, "price" | "rentBonus">>;
const part = (p: PartInput): Part => ({ price: 0, rentBonus: 0, ...p });

export const PARTS: Part[] = [
  // ---------- Grundkörper ----------
  part({
    id: "base-brick",
    name: "Backstein",
    category: "base",
    svg: `<rect width="40" height="50" fill="#e07a5f"/><path d="M0 12.5h40M0 25h40M0 37.5h40M20 0v12.5M10 12.5v12.5M30 12.5v12.5M20 25v12.5M10 37.5v12.5M30 37.5v12.5" stroke="#b5533c" stroke-width="1.5"/>`,
  }),
  part({
    id: "base-wood",
    name: "Holz",
    category: "base",
    svg: `<rect width="40" height="50" fill="#c68b59"/><path d="M0 10h40M0 20h40M0 30h40M0 40h40" stroke="#9c6b43" stroke-width="1.5"/><path d="M12 0v10M30 10v10M8 20v10M26 30v10M16 40v10" stroke="#9c6b43"/>`,
  }),
  part({
    id: "base-chocolate",
    price: 800,
    name: "Schokolade",
    category: "base",
    svg: `<rect width="40" height="50" fill="#5c3317"/><g fill="#7b4a2a"><rect x="2" y="2" width="16" height="21" rx="2"/><rect x="22" y="2" width="16" height="21" rx="2"/><rect x="2" y="27" width="16" height="21" rx="2"/><rect x="22" y="27" width="16" height="21" rx="2"/></g><path d="M4 4.5h12M24 4.5h12M4 29.5h12M24 29.5h12" stroke="#a0673f" stroke-width="1.5"/>`,
  }),
  part({
    id: "base-gummy",
    price: 1500,
    name: "Gummibärchen",
    category: "base",
    svg: `<rect width="40" height="50" fill="#fff3d6"/>${gummyBear(0, 0, "#ff595e")}${gummyBear(20, 0, "#8ac926")}${gummyBear(0, 25, "#ffca3a")}${gummyBear(20, 25, "#1982c4")}`,
  }),
  part({
    id: "base-ice",
    price: 600,
    name: "Eis",
    category: "base",
    svg: `<rect width="40" height="50" fill="#caf0f8"/><path d="M0 16.6h40M0 33.3h40M20 0v16.6M10 16.6v16.7M30 16.6v16.7M20 33.3v16.7" stroke="#90e0ef" stroke-width="1.5"/><path d="M4 7l6-4M24 23l6-4M6 41l6-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  }),

  // ---------- Dächer ----------
  part({
    id: "roof-flat",
    name: "Flachdach",
    category: "roof",
    svg: `<rect y="24" width="100" height="16" fill="#6d597a" ${OUTLINE} stroke-width="3"/>`,
  }),
  part({
    id: "roof-pitched",
    name: "Spitzdach",
    category: "roof",
    svg: `<polygon points="0,40 50,1 100,40" fill="#ef476f" ${OUTLINE} stroke-width="3" stroke-linejoin="round"/><path d="M25 20.5h50M12 30.5h76" stroke="#c9184a" stroke-width="2" vector-effect="non-scaling-stroke"/>`,
  }),
  part({
    id: "roof-chimney",
    name: "Ziegeldach mit Schornstein",
    category: "roof",
    svg: `<rect x="68" y="4" width="9" height="22" fill="#b5533c" ${OUTLINE} stroke-width="3"/><rect x="66" y="2" width="13" height="4" fill="#6d597a" ${OUTLINE} stroke-width="2"/><polygon points="0,40 50,2 100,40" fill="#9c6644" ${OUTLINE} stroke-width="3" stroke-linejoin="round"/><path d="M25 21h50M12 31h76" stroke="#7f5539" stroke-width="2" vector-effect="non-scaling-stroke"/>`,
  }),
  part({
    id: "roof-dome",
    price: 600,
    name: "Kuppel",
    category: "roof",
    svg: `<path d="M3 40C3 4 97 4 97 40Z" fill="#f78fb3" ${OUTLINE} stroke-width="3"/><path d="M20 22C30 13 45 10 55 10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6" vector-effect="non-scaling-stroke"/>`,
  }),
  part({
    id: "roof-icing",
    price: 900,
    name: "Zuckerguss",
    category: "roof",
    svg: `<rect y="14" width="100" height="26" fill="#ffb3c6" ${OUTLINE} stroke-width="3"/><path d="M0 14h100v10q-5 9-10 0q-5 11-10 0q-5 8-10 0q-5 12-10 0q-5 8-10 0q-5 10-10 0q-5 8-10 0q-5 11-10 0q-5 8-10 0q-5 9-10 0z" fill="#fff" ${OUTLINE} stroke-width="2"/><g fill="#06d6a0"><rect x="12" y="16" width="4" height="2"/><rect x="47" y="17" width="4" height="2"/><rect x="82" y="16" width="4" height="2"/></g><g fill="#ffca3a"><rect x="28" y="18" width="4" height="2"/><rect x="66" y="16" width="4" height="2"/></g>`,
  }),
  part({
    id: "roof-battlements",
    price: 1200,
    name: "Burgzinnen",
    category: "roof",
    svg: `<path d="M0 40V14h12v10h10V14h12v10h10V14h12v10h10V14h12v10h10V14h12v26z" fill="#b5a1e6" ${OUTLINE} stroke-width="3" stroke-linejoin="round"/>`,
  }),

  // ---------- Türen ----------
  part({
    id: "door-shop",
    name: "Ladentür",
    category: "door",
    use: "commercial",
    mount: "ground",
    svg: `<rect x="10" y="17" width="20" height="33" rx="3" fill="#8d5a3b" stroke="${INK}" stroke-width="2.5"/><circle cx="25" cy="34" r="2" fill="#ffd166"/>`,
  }),
  part({
    id: "door-arch",
    name: "Bogentür",
    category: "door",
    use: "residential",
    mount: "ground",
    svg: `<path d="M9 50V30a11 11 0 0 1 22 0v20z" fill="#6a4c93" stroke="${INK}" stroke-width="2.5"/><path d="M20 19v31" stroke="${INK}" stroke-width="1.5"/><circle cx="24" cy="38" r="1.8" fill="#ffd166"/><circle cx="16" cy="38" r="1.8" fill="#ffd166"/>`,
  }),
  part({
    id: "door-glass",
    price: 300,
    name: "Glastür",
    category: "door",
    use: "commercial",
    mount: "ground",
    svg: `<rect x="5" y="17" width="30" height="33" rx="2" fill="#a8dadc" stroke="${INK}" stroke-width="2.5"/><path d="M20 17v33" stroke="${INK}" stroke-width="2"/><path d="M9 23l5-4M24 23l5-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M17 31v6M23 31v6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  }),

  part({
    id: "door-house",
    name: "Haustür",
    category: "door",
    mount: "ground",
    use: "residential",
    svg: `<path d="M5 16h30l-4-6H9z" fill="#8d99ae" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="11" y="18" width="18" height="32" rx="2" fill="#2a9d8f" stroke="${INK}" stroke-width="2.5"/><rect x="15" y="22" width="10" height="8" rx="1.5" fill="#bde0fe" stroke="${INK}" stroke-width="1.5"/><circle cx="25" cy="37" r="1.8" fill="#ffd166"/><rect x="31" y="30" width="5" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="33.5" cy="32.5" r="1" fill="${INK}"/>`,
  }),

  // ---------- Fenster ----------
  part({
    id: "window-square",
    name: "Sprossenfenster",
    category: "window",
    svg: `<rect x="8" y="16" width="24" height="22" rx="2" fill="#bde0fe" stroke="${INK}" stroke-width="2.5"/><path d="M20 16v22M8 27h24" stroke="${INK}" stroke-width="2"/>`,
  }),
  part({
    id: "window-round",
    name: "Bullauge",
    category: "window",
    svg: `<circle cx="20" cy="27" r="11" fill="#bde0fe" stroke="${INK}" stroke-width="2.5"/><path d="M20 16v22M9 27h22" stroke="${INK}" stroke-width="1.8"/><path d="M13 23a8 8 0 0 1 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  }),
  part({
    id: "window-arch",
    price: 300,
    name: "Bogenfenster",
    category: "window",
    svg: `<path d="M9 38V26a11 11 0 0 1 22 0v12z" fill="#cdb4db" stroke="${INK}" stroke-width="2.5"/><path d="M20 15v23M9 28h22" stroke="${INK}" stroke-width="1.8"/>`,
  }),

  part({
    id: "window-balcony",
    price: 300,
    name: "Balkon",
    category: "window",
    use: "residential",
    svg: `<rect x="9" y="12" width="22" height="27" rx="2" fill="#bde0fe" stroke="${INK}" stroke-width="2.5"/><path d="M20 12v27" stroke="${INK}" stroke-width="2"/><path d="M12 18l5-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="2" y="39" width="36" height="4" rx="1" fill="#adb5bd" stroke="${INK}" stroke-width="1.8"/><path d="M3 30h34M7 30v9M13 30v9M20 30v9M27 30v9M33 30v9" stroke="${INK}" stroke-width="1.8" fill="none"/><circle cx="6" cy="28" r="3" fill="#ef476f" stroke="${INK}" stroke-width="1"/><circle cx="34" cy="28" r="3" fill="#ffca3a" stroke="${INK}" stroke-width="1"/>`,
  }),
  part({
    id: "window-shop",
    name: "Schaufenster",
    category: "window",
    use: "commercial",
    svg: `<rect x="3" y="14" width="34" height="30" rx="2" fill="#caf0f8" stroke="${INK}" stroke-width="2.5"/><path d="M3 36h34" stroke="${INK}" stroke-width="2"/><rect x="7" y="28" width="7" height="8" fill="#ef476f" stroke="${INK}" stroke-width="1"/><rect x="16" y="25" width="7" height="11" fill="#ffca3a" stroke="${INK}" stroke-width="1"/><rect x="25" y="29" width="8" height="7" fill="#06d6a0" stroke="${INK}" stroke-width="1"/><path d="M7 20l6-4M21 20l6-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  }),
  part({
    id: "window-doner",
    price: 500,
    name: "Dönergrill",
    category: "window",
    use: "commercial",
    svg: `<rect x="5" y="14" width="30" height="27" rx="2" fill="#ffe8cc" stroke="${INK}" stroke-width="2.5"/><rect x="27" y="17" width="5" height="21" rx="1" fill="#ff7b00" opacity=".75"/><path d="M18 15v25" stroke="#666" stroke-width="1.5"/><path d="M12 18h12l-3 18h-6z" fill="#b5651d" stroke="${INK}" stroke-width="1.5"/><rect x="11" y="37" width="14" height="2.5" fill="#999"/>`,
  }),
  part({
    id: "window-optician",
    price: 400,
    name: "Brillen-Schaufenster",
    category: "window",
    use: "commercial",
    svg: `<rect x="4" y="14" width="32" height="27" rx="2" fill="#e0fbfc" stroke="${INK}" stroke-width="2.5"/><circle cx="14" cy="29" r="5" fill="#fff" stroke="${INK}" stroke-width="2.2"/><circle cx="26" cy="29" r="5" fill="#fff" stroke="${INK}" stroke-width="2.2"/><path d="M19 28h2M9 28l-3-2M31 28l3-2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M8 20l6-4M22 20l6-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  }),
  part({
    id: "window-icecream",
    price: 400,
    name: "Eistheke",
    category: "window",
    use: "commercial",
    svg: `<rect x="4" y="14" width="32" height="27" rx="2" fill="#fff0f6" stroke="${INK}" stroke-width="2.5"/><path d="M4 33h32" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="31" r="3.5" fill="#ffafcc" stroke="${INK}" stroke-width="1"/><circle cx="20" cy="31" r="3.5" fill="#caffbf" stroke="${INK}" stroke-width="1"/><circle cx="28" cy="31" r="3.5" fill="#ffd6a5" stroke="${INK}" stroke-width="1"/><path d="M17 20l3 9 3-9z" fill="#e9c46a" stroke="${INK}" stroke-width="1"/><circle cx="20" cy="19" r="3.5" fill="#ffafcc" stroke="${INK}" stroke-width="1"/>`,
  }),

  // ---------- Deko ----------
  part({
    id: "deco-sign",
    name: "Schild",
    category: "deco",
    use: "commercial",
    rentBonus: DECO,
    textFill: INK,
    svg: `<rect x="1" y="1" width="38" height="14" rx="3" fill="#ffd166" stroke="${INK}" stroke-width="2"/>`,
  }),
  part({
    id: "deco-neon",
    price: 500,
    name: "Neonschrift",
    category: "deco",
    use: "commercial",
    rentBonus: DECO,
    textFill: "#ff8ad8",
    svg: `<rect x="1" y="1" width="38" height="14" rx="3" fill="#241b2f" stroke="#ff5fd2" stroke-width="2"/>`,
  }),
  part({
    id: "deco-awning",
    name: "Markise",
    category: "deco",
    use: "commercial",
    rentBonus: DECO,
    svg: `<path d="M-1 1h42v8l-5.25 5-5.25-5-5.25 5-5.25-5-5.25 5-5.25-5-5.25 5-5.25-5z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M4.25 1h10.5v8l-5.25 5-5.25-5zM25.25 1h10.5v8l-5.25 5-5.25-5z" fill="#e63946"/><path d="M-1 1h42" stroke="${INK}" stroke-width="2.5"/>`,
  }),
  part({
    id: "deco-flowerbox",
    name: "Blumenkasten",
    category: "deco",
    use: "residential",
    rentBonus: DECO,
    svg: `<path d="M12 38v-3M18 37v-4M24 38v-3M29 37v-3" stroke="#2d6a4f" stroke-width="1.5"/><circle cx="11" cy="35" r="3" fill="#ef476f" stroke="${INK}" stroke-width="1"/><circle cx="17.5" cy="33.5" r="3" fill="#ffca3a" stroke="${INK}" stroke-width="1"/><circle cx="24" cy="35" r="3" fill="#ef476f" stroke="${INK}" stroke-width="1"/><circle cx="30" cy="34" r="3" fill="#b5179e" stroke="${INK}" stroke-width="1"/><rect x="7" y="38" width="26" height="6" rx="1.5" fill="#8d5a3b" stroke="${INK}" stroke-width="1.8"/>`,
  }),
  part({
    id: "deco-tree",
    price: 300,
    name: "Baum",
    category: "deco",
    mount: "ground",
    rentBonus: DECO,
    svg: `<rect x="17" y="30" width="6" height="20" fill="#8d5a3b" stroke="${INK}" stroke-width="1.5"/><circle cx="20" cy="19" r="13" fill="#52b788" stroke="${INK}" stroke-width="2"/><circle cx="13" cy="15" r="3.5" fill="#95d5b2"/><circle cx="25" cy="22" r="2" fill="#e63946"/><circle cx="16" cy="25" r="2" fill="#e63946"/>`,
  }),
  part({
    id: "deco-fountain",
    price: 800,
    name: "Schokobrunnen",
    category: "deco",
    mount: "ground",
    rentBonus: DECO,
    svg: `<rect x="17" y="30" width="6" height="12" fill="#8d5a3b" stroke="${INK}" stroke-width="1.5"/><path d="M4 42h32l-4 8H8z" fill="#8d5a3b" stroke="${INK}" stroke-width="2"/><path d="M10 28h20l-3 5H13z" fill="#8d5a3b" stroke="${INK}" stroke-width="2"/><path d="M12 33q-3 4-2 9M28 33q3 4 2 9" stroke="#4a2511" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M6 42h28" stroke="#4a2511" stroke-width="3"/><circle cx="20" cy="25" r="3.5" fill="#4a2511"/>`,
  }),
  part({
    id: "deco-fence",
    price: 400,
    name: "Zuckerstangen-Zaun",
    category: "deco",
    mount: "ground",
    rentBonus: DECO,
    svg: `<rect x="0" y="39" width="40" height="3" fill="#e63946"/>${candyCane(7)}${candyCane(20)}${candyCane(33)}`,
  }),
  part({
    id: "deco-palm",
    price: 400,
    name: "Palme",
    category: "deco",
    mount: "ground",
    rentBonus: DECO,
    svg: `<path d="M19 50Q17 32 21 12" stroke="#8d5a3b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M16 42h6M16 34h5M17 26h5M18 19h5" stroke="#6b4226" stroke-width="1.5"/><g fill="#2a9d8f" stroke="${INK}" stroke-width="1.5"><ellipse cx="11" cy="12" rx="11" ry="4" transform="rotate(-20 11 12)"/><ellipse cx="31" cy="12" rx="11" ry="4" transform="rotate(20 31 12)"/><ellipse cx="14" cy="6" rx="9" ry="3.5" transform="rotate(35 14 6)"/><ellipse cx="28" cy="6" rx="9" ry="3.5" transform="rotate(-35 28 6)"/></g><circle cx="19" cy="14" r="2.6" fill="#6b4226"/><circle cx="23.5" cy="14.5" r="2.6" fill="#6b4226"/>`,
  }),
  part({
    id: "deco-antenna",
    name: "Antenne",
    category: "deco",
    mount: "roof",
    rentBonus: DECO,
    svg: `<path d="M20 50V-8" stroke="#555" stroke-width="2.5"/><path d="M9 6h22M13-1h14" stroke="#555" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="-9" r="2.8" fill="#e63946"/>`,
  }),
  part({
    id: "deco-flag",
    price: 300,
    name: "Flagge",
    category: "deco",
    mount: "roof",
    rentBonus: DECO,
    svg: `<path d="M14 50V-12" stroke="${INK}" stroke-width="2.5"/><path d="M15-12h21l-6 7 6 7H15z" fill="#ff595e" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  }),
];

const byId = new Map(PARTS.map((p) => [p.id, p]));

export function getPart(id: string): Part | undefined {
  return byId.get(id);
}

export function partsOf(category: PartCategory): Part[] {
  return PARTS.filter((p) => p.category === category);
}

export const mountOf = (part: Part): PartMount => part.mount ?? "wall";

/** Darf der Spieler dieses Teil im Baukasten und beim Würfeln verwenden? */
export function isUnlocked(part: Part, unlockedParts: readonly string[]): boolean {
  return part.price === 0 || unlockedParts.includes(part.id);
}
