import type { OsmStreetRef } from "../../model/types";
import type { HairStyle, ItemDesign, Slot } from "../config/items";

/** Was der Server über mich weiß (api/v2/me). */
export interface V2Account {
  id: string;
  name: string;
}

export interface MemberData {
  coins: number;
  /** Bis wann die Ladenkassen eingesammelt wurden. */
  collectedAt: number;
  /** Die eigene Figur (fehlt, bis man sie das erste Mal angezogen hat). */
  figure?: Figure;
  /** Gekaufte Waren. */
  inventory?: OwnedItem[];
  /** Wie oft man heute schon erfunden hat (Tag als YYYY-MM-DD). */
  invented?: { day: string; count: number };
  /** Vom Server gezählt: an Spieler verkaufte Waren. */
  sales?: number;
}

export interface FigureBase {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
}

/** Ein getragenes Stück – trägt Design und Herkunft mit, damit jeder die Figur ohne fremden Schrank zeichnen kann. */
export interface WornItem {
  id: string;
  name: string;
  design: ItemDesign;
  shopId?: string;
  shopName?: string;
}

/** Was die Figur gerade trägt, je Platz (Grund-Teile heißen „starter:…“). */
export interface Figure {
  base: FigureBase;
  worn: Partial<Record<Slot, WornItem>>;
}

/** Eine Ware im Sortiment eines Ladens. */
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  design: ItemDesign;
  price: number;
  showcase: boolean;
  createdAt: number;
  /** An Spieler verkauft. */
  sold: number;
}

/** Eine gekaufte Ware im eigenen Schrank – trägt ihren Laden mit sich („wo hat der das her?“). */
export interface OwnedItem {
  id: string;
  itemId: string;
  shopId: string;
  shopName: string;
  name: string;
  design: ItemDesign;
  price: number;
  boughtAt: number;
}

export interface Member {
  id: string;
  name: string;
  joinedAt: number;
  data: Partial<MemberData>;
}

export interface MemberSummary {
  id: string;
  name: string;
  joinedAt: number;
  figure?: Figure | null;
}

export interface Shop {
  id: string;
  memberId: string;
  type: string;
  name: string;
  look: number;
  openedAt: number;
  data: { items?: ShopItem[] } & Record<string, unknown>;
}

export interface StreetV2 {
  id: string;
  name: string;
  city: string;
  osm: OsmStreetRef | null;
  founderAccountId: string;
  foundedAt: number;
  maxMembers: number;
  members: MemberSummary[];
  shops: Shop[];
}

/** Eine Straße in der Bummel-Liste. */
export interface StreetListing {
  id: string;
  name: string;
  city: string;
  members: number;
  shops: number;
  foundedAt: number;
}

export type NewsKind = "join" | "leave" | "shop" | "close" | "item" | "buy";

/** Ein Ereignis in der Zeitung einer Straße. */
export interface NewsEvent {
  id: string;
  kind: NewsKind;
  memberId: string | null;
  at: number;
  data: {
    who?: string;
    visitor?: boolean;
    shopId?: string;
    shopName?: string;
    type?: string;
    shops?: number;
    item?: { id: string; name: string; price: number; design: ItemDesign | null };
  };
}

export interface V2State {
  account: V2Account;
  member: Member | null;
  street: StreetV2 | null;
}

/** Ein Bauplatz der Straße mit seinem (berechneten) Haus. */
export type HouseStage = 0 | 1 | 2 | 3 | 4;

export interface Lot {
  id: string;
  /** oben links/rechts der Mall oder unten gegenüber */
  row: "top" | "bottom";
  index: number;
  stage: HouseStage;
  residents: number;
}
