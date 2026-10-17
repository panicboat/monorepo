import type { ProfileSummaryView } from "@/modules/profile/types";

export interface FootprintView {
  visitor: ProfileSummaryView | null;
  lastVisitedAt: string;
  isUnread: boolean;
  visitCount: number;
}

export interface PaginatedFootprintsResponse {
  footprints: FootprintView[];
  nextCursor: string;
  hasMore: boolean;
}
