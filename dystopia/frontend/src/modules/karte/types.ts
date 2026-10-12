export type KarteStage = "booking" | "service" | "after_service";
export type KarteStatus = "open" | "closed";

export interface KarteEventInput {
  stage: KarteStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
}

export interface KarteEvent extends KarteEventInput {
  id: string;
  entryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface KarteEntry {
  id: string;
  authorProfileId: string;
  targetProfileId: string;
  isMine: boolean;
  authorUsername: string;
  authorAvatarUrl: string;
  targetUsername: string;
  targetAvatarUrl: string;
  rating: number | null;
  body: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
  status: KarteStatus;
  closedAt: string | null;
  events: KarteEvent[];
  latestEvent: KarteEvent | null;
  eventCount: number;
}

export interface KarteAggregate {
  count: number;
  avgRating: number | null;
  authorCount: number;
  ratedCount: number;
}

export interface KarteCounts {
  total: number;
  open: number;
  closed: number;
}

export interface PaginatedKarteByTargetResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
  aggregate: KarteAggregate;
}

export interface PaginatedKarteMyResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
  counts: KarteCounts;
}

export interface PaginatedKarteRecentResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface KarteAccess {
  hasAccess: boolean;
  grantedAt: string | null;
}
