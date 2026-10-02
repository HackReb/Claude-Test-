/**
 * Babo v2: Die Ladentypen der Mall. Muss zu server/src/Service/ShopTypes.php passen (gleiche IDs).
 * Jeder Typ hat eine Gruppe (ein Bedürfnis der Bewohner), ein Symbol und drei Fassaden-Varianten („Looks“).
 */
export type ShopGroup = "mode" | "tiere" | "technik" | "freizeit" | "fahrzeuge" | "alltag" | "ausgefallen";

export interface ShopLook {
  /** Wandfarbe, Markise/Vordach, Akzent (Rahmen, Tür). */
  wall: string;
  awning: string;
  trim: string;
}

export interface ShopType {
  id: string;
  name: string;
  group: ShopGroup;
  emoji: string;
  /** Was man hier später erfindet (für die Auswahl). */
  sells: string;
  looks: [ShopLook, ShopLook, ShopLook];
}

export const SHOP_GROUPS: Record<ShopGroup, { name: string; emoji: string }> = {
  mode: { name: "Mode", emoji: "👗" },
  tiere: { name: "Tiere", emoji: "🐾" },
  technik: { name: "Technik", emoji: "🤖" },
  freizeit: { name: "Freizeit", emoji: "🎸" },
  fahrzeuge: { name: "Fahrzeuge", emoji: "🚗" },
  alltag: { name: "Alltag", emoji: "🥐" },
  ausgefallen: { name: "Ausgefallen", emoji: "🪄" },
};

const looks = (a: [string, string, string], b: [string, string, string], c: [string, string, string]): [ShopLook, ShopLook, ShopLook] => [
  { wall: a[0], awning: a[1], trim: a[2] },
  { wall: b[0], awning: b[1], trim: b[2] },
  { wall: c[0], awning: c[1], trim: c[2] },
];

const shop = (id: string, name: string, group: ShopGroup, emoji: string, sells: string, l: [ShopLook, ShopLook, ShopLook]): ShopType => ({
  id,
  name,
  group,
  emoji,
  sells,
  looks: l,
});

export const SHOP_TYPES: ShopType[] = [
  // ---------- Mode ----------
  shop("mode", "Modegeschäft", "mode", "👗", "Kleidung aller Art", looks(["#ffe3ef", "#ef476f", "#2b2118"], ["#f1f1f1", "#2b2118", "#ffd166"], ["#e7e0ff", "#6a4c93", "#2b2118"])),
  shop("hutmacher", "Hutmacher", "mode", "🎩", "Hüte, Mützen, Kronen", looks(["#f4e4c1", "#6b4226", "#2b2118"], ["#ffffff", "#1d3557", "#ffd166"], ["#ffe8d6", "#e76f51", "#2b2118"])),
  shop("schuhladen", "Schuhladen", "mode", "👟", "Schuhe, Stiefel, Rollschuhe", looks(["#e0f7fa", "#1982c4", "#2b2118"], ["#fff1c1", "#ff7a45", "#2b2118"], ["#f1f1f1", "#06d6a0", "#2b2118"])),
  shop("optiker", "Optiker", "mode", "👓", "Brillen und Sonnenbrillen", looks(["#ffffff", "#118ab2", "#2b2118"], ["#eef2ff", "#2b2118", "#118ab2"], ["#fff4d6", "#ffd166", "#2b2118"])),
  shop("kostuemverleih", "Kostümverleih", "mode", "🎭", "Kostüme von Pirat bis Astronaut", looks(["#fde2e4", "#9d0208", "#ffd166"], ["#e2ece9", "#2a9d8f", "#2b2118"], ["#f3e8ff", "#7b2cbf", "#ffd166"])),
  shop("schmuck", "Juwelier", "mode", "💍", "Ketten, Ringe, Glitzer", looks(["#fff8e1", "#c9a227", "#2b2118"], ["#1b1f3a", "#ffd166", "#ffffff"], ["#fde9f3", "#ef476f", "#2b2118"])),

  // ---------- Tiere ----------
  shop("tierhandlung", "Tierhandlung", "tiere", "🐶", "Hunde, Katzen, Hamster", looks(["#e8f5e9", "#43a047", "#2b2118"], ["#fff3e0", "#fb8c00", "#2b2118"], ["#e3f2fd", "#1e88e5", "#2b2118"])),
  shop("aquarium", "Aquarium", "tiere", "🐠", "Fische, Schildkröten, Kraken", looks(["#d7f3ff", "#0096c7", "#2b2118"], ["#e0f7fa", "#00b4d8", "#ffffff"], ["#caf0f8", "#023e8a", "#90e0ef"])),
  shop("fabelzoo", "Fabelwesen-Zoo", "tiere", "🦄", "Einhörner, Drachen, Dinos", looks(["#f3e8ff", "#9b5de5", "#ffd166"], ["#ffe5ec", "#ff5d8f", "#2b2118"], ["#e0ffe8", "#00bb7e", "#2b2118"])),

  // ---------- Technik ----------
  shop("elektronik", "Elektronik", "technik", "📱", "Gadgets, Kopfhörer, Drohnen", looks(["#f1f1f1", "#2b2118", "#06d6a0"], ["#e8f0fe", "#1a73e8", "#ffffff"], ["#1b1f3a", "#b7ff5a", "#ffffff"])),
  shop("videospiele", "Videospiele", "technik", "🎮", "Konsolen, Controller, Pixelzeug", looks(["#1b1f3a", "#ff2e63", "#ffffff"], ["#eef2ff", "#4361ee", "#ffd166"], ["#fff0f3", "#f72585", "#2b2118"])),
  shop("roboterwerkstatt", "Roboterwerkstatt", "technik", "🤖", "Roboter-Begleiter und Bauteile", looks(["#e9ecef", "#495057", "#ffd166"], ["#dee2e6", "#f77f00", "#2b2118"], ["#d8f3dc", "#2d6a4f", "#ffffff"])),

  // ---------- Freizeit ----------
  shop("sportladen", "Sportladen", "freizeit", "⚽", "Bälle, Trikots, Schläger", looks(["#e0f2f1", "#00897b", "#2b2118"], ["#fff3e0", "#e65100", "#2b2118"], ["#f1f8e9", "#558b2f", "#ffffff"])),
  shop("musikladen", "Musikladen", "freizeit", "🎸", "Gitarren, Trommeln, Tröten", looks(["#fff8e1", "#6b4226", "#2b2118"], ["#2b2118", "#ffd166", "#ffffff"], ["#e3f2fd", "#5e35b1", "#ffd166"])),
  shop("spielwaren", "Spielwaren", "freizeit", "🧸", "Teddys, Bauklötze, Drachen", looks(["#fff1c1", "#ef476f", "#118ab2"], ["#e0f7fa", "#ffd166", "#ef476f"], ["#ffe5ec", "#06d6a0", "#2b2118"])),
  shop("zauberladen", "Zauberladen", "freizeit", "🪄", "Zauberstäbe, Hüte, Tricks", looks(["#2b2118", "#7b2cbf", "#ffd166"], ["#f3e8ff", "#3c096c", "#ffd166"], ["#1b1f3a", "#ffd166", "#ffffff"])),
  shop("buchladen", "Buchladen", "freizeit", "📚", "Bücher, Comics, Lesebrillen", looks(["#f4e4c1", "#6b4226", "#2b2118"], ["#e8f5e9", "#2e7d32", "#ffffff"], ["#fff3e0", "#bf360c", "#2b2118"])),

  // ---------- Fahrzeuge ----------
  shop("fahrradladen", "Fahrradladen", "fahrzeuge", "🚲", "Räder, Roller, Skateboards", looks(["#e8f5e9", "#2e7d32", "#2b2118"], ["#fff3e0", "#ff7a45", "#2b2118"], ["#e3f2fd", "#1565c0", "#ffffff"])),
  shop("autohaus", "Autohaus", "fahrzeuge", "🚗", "Autos, Cabrios, Laster", looks(["#f1f1f1", "#2b2118", "#ff7a45"], ["#e8f0fe", "#d62828", "#ffffff"], ["#1b1f3a", "#48cae4", "#ffffff"])),
  shop("raumschiffwerft", "Raumschiff-Werft", "fahrzeuge", "🚀", "Raumgleiter und Jetpacks", looks(["#1b1f3a", "#b7ff5a", "#ffffff"], ["#e9ecef", "#4361ee", "#ffd166"], ["#2b2118", "#ff2e63", "#ffffff"])),

  // ---------- Alltag ----------
  shop("drogerie", "Drogerie", "alltag", "🧴", "Schminke, Seife, Pflaster", looks(["#e0f7fa", "#00acc1", "#2b2118"], ["#fce4ec", "#ec407a", "#ffffff"], ["#f1f8e9", "#7cb342", "#2b2118"])),
  shop("friseur", "Friseur", "alltag", "💇", "Frisuren und Bärte", looks(["#ffe5ec", "#ff5d8f", "#2b2118"], ["#e3f2fd", "#1e88e5", "#ffffff"], ["#fff8e1", "#2b2118", "#ffd166"])),
  shop("blumenladen", "Blumenladen", "alltag", "💐", "Sträuße, Topfpflanzen, Kakteen", looks(["#e8f5e9", "#ef476f", "#43a047"], ["#fff1c1", "#06d6a0", "#2b2118"], ["#fde2e4", "#9d0208", "#2b2118"])),
  shop("baeckerei", "Bäckerei", "alltag", "🥐", "Brezeln, Kuchen, Donuts", looks(["#fff3e0", "#d62828", "#2b2118"], ["#f4e4c1", "#6b4226", "#ffd166"], ["#ffffff", "#ff7a45", "#2b2118"])),
  shop("eisdiele", "Eisdiele", "alltag", "🍦", "Eis in allen Farben", looks(["#ffe3ef", "#ff8fab", "#2b2118"], ["#e0f7fa", "#ffd166", "#ef476f"], ["#fff1c1", "#06d6a0", "#2b2118"])),
  shop("doener", "Dönerbude", "alltag", "🥙", "Döner, Dürüm, Ayran", looks(["#fff3e0", "#d62828", "#ffd166"], ["#e8f5e9", "#2e7d32", "#ffffff"], ["#ffffff", "#ff7a45", "#2b2118"])),
  shop("supermarkt", "Supermarkt", "alltag", "🛒", "Alles für den Einkaufskorb", looks(["#e3f2fd", "#1565c0", "#ffd166"], ["#f1f8e9", "#2e7d32", "#ffffff"], ["#fff3e0", "#ef6c00", "#2b2118"])),
  shop("kiosk", "Kiosk", "alltag", "🏪", "Zeitungen, Süßes, Kaugummi", looks(["#fff1c1", "#1982c4", "#2b2118"], ["#ffe8d6", "#ef476f", "#2b2118"], ["#e0f7fa", "#ffd166", "#2b2118"])),

  // ---------- Ausgefallen ----------
  shop("ruestungsschmiede", "Rüstungsschmiede", "ausgefallen", "⚔️", "Rüstungen, Helme, Schilde", looks(["#e9ecef", "#495057", "#ffd166"], ["#2b2118", "#9d0208", "#ffffff"], ["#f4e4c1", "#6b4226", "#2b2118"])),
  shop("piratenbedarf", "Piratenbedarf", "ausgefallen", "🏴‍☠️", "Augenklappen, Papageien, Säbel", looks(["#2b2118", "#d62828", "#ffd166"], ["#f4e4c1", "#1d3557", "#2b2118"], ["#e0f7fa", "#2b2118", "#ffd166"])),
  shop("weltraumladen", "Weltraumladen", "ausgefallen", "👽", "Raumanzüge, Antennen, Alienhüte", looks(["#1b1f3a", "#b7ff5a", "#ffffff"], ["#e0e7ff", "#5e60ce", "#ffd166"], ["#2b2118", "#48cae4", "#ffffff"])),
  shop("hexenkueche", "Hexenküche", "ausgefallen", "🧙", "Tränke, Besen, spitze Hüte", looks(["#2b2118", "#7b2cbf", "#b7ff5a"], ["#d8f3dc", "#1b4332", "#ffd166"], ["#f3e8ff", "#2b2118", "#9b5de5"])),
  shop("dinoladen", "Dinoladen", "ausgefallen", "🦖", "Dinos in allen Farben", looks(["#e8f5e9", "#2e7d32", "#ffd166"], ["#fff1c1", "#e76f51", "#2b2118"], ["#d7f3ff", "#118ab2", "#2b2118"])),
  shop("superheldenbedarf", "Superheldenbedarf", "ausgefallen", "🦸", "Umhänge, Masken, Superkräfte", looks(["#e3f2fd", "#d62828", "#ffd166"], ["#1b1f3a", "#ffd166", "#ffffff"], ["#fde2e4", "#1565c0", "#ffffff"])),
];

export const shopType = (id: string): ShopType | undefined => SHOP_TYPES.find((t) => t.id === id);

/** Unbekannter Typ (z. B. älterer Stand): neutraler Platzhalter, damit die Mall trotzdem gezeichnet wird. */
export const FALLBACK_SHOP: ShopType = shop("unbekannt", "Laden", "alltag", "🏬", "", looks(["#f1f1f1", "#2b2118", "#ffd166"], ["#f1f1f1", "#2b2118", "#ffd166"], ["#f1f1f1", "#2b2118", "#ffd166"]));

export const MAX_SHOPS_PER_MEMBER = 3;
export const SHOP_NAME_MAX = 24;
export const LOOKS = 3;
