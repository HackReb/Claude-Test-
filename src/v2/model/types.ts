import type { OsmStreetRef } from "../../model/types";

/** Was der Server über mich weiß (api/v2/me). */
export interface V2Account {
  id: string;
  name: string;
}

export interface MemberData {
  coins: number;
  /** Bis wann die Ladenkassen eingesammelt wurden. */
  collectedAt: number;
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
}

export interface Shop {
  id: string;
  memberId: string;
  type: string;
  name: string;
  look: number;
  openedAt: number;
  data: Record<string, unknown>;
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
