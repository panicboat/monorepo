export interface KarteEntry {
  id: string;
  authorAccountId: string;
  targetAccountId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  rating: number;
  body: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KarteAggregate {
  count: number;
  avgRating: number;
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
}

export interface KarteAccess {
  hasAccess: boolean;
  grantedAt: string | null;
}
