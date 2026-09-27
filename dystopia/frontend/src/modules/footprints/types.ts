
export interface FootprintVisitorView {
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FootprintView {
  visitor: FootprintVisitorView;
  lastVisitedAt: string;
  isUnread: boolean;
  visitCount: number;
}

export interface PaginatedFootprintsResponse {
  footprints: FootprintView[];
  nextCursor: string;
  hasMore: boolean;
}
