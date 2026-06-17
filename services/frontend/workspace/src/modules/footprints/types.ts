// View shapes for footprints module.
// Visitor is the rx-sns-equivalent: "誰が私を訪問したか" (incoming-direction).

export interface FootprintVisitorView {
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FootprintView {
  visitor: FootprintVisitorView;
  lastVisitedAt: string; // ISO8601
  isUnread: boolean;
}

export interface PaginatedFootprintsResponse {
  footprints: FootprintView[];
  nextCursor: string;
  hasMore: boolean;
}
