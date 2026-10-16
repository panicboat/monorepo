export type KarteStage = "reservation" | "service" | "aftercare";
export type KarteStatus = "open" | "closed";

export interface KarteEvent {
  id: string;
  stage: KarteStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface Karte {
  id: string;
  authorProfileId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  targetProfileId: string;
  targetUsername: string;
  targetAvatarUrl: string;
  isMine: boolean;
  rating: number | null;
  status: KarteStatus;
  events: KarteEvent[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface KarteEventInput {
  stage: KarteStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
}

export interface ReliabilitySummary {
  averageRating: number | null;
  raterCount: number;
  karteCount: number;
}

export interface KartePage {
  kartes: Karte[];
  nextCursor: string;
  hasMore: boolean;
}

export interface KartesByTargetPage extends KartePage {
  reliability: ReliabilitySummary;
}
