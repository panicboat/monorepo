import type { ProfileSummaryView } from "@/modules/profile/types";

export type KarteStage = "reservation" | "service" | "aftercare";

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
  author: ProfileSummaryView | null;
  targetProfileId: string;
  target: ProfileSummaryView | null;
  isMine: boolean;
  rating: number | null;
  events: KarteEvent[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
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

export interface KarteCounts {
  total: number;
  unrated: number;
}

export interface MyKartePage extends KartePage {
  counts: KarteCounts;
}
