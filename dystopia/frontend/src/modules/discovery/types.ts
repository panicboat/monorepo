import type { PostView } from "@/modules/post/lib/post-view";
import type { ProfileSummaryView } from "@/modules/profile/types";

export type RankPeriodLiteral = "day" | "week" | "all";

export interface PaginatedUsersResponse {
  profiles: ProfileSummaryView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
