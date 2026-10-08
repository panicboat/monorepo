import type { PostView } from "@/modules/post/lib/post-view";
import type { SocialProfileView } from "@/modules/social";

export type RankPeriodLiteral = "day" | "week" | "all";

export interface PaginatedUsersResponse {
  profiles: SocialProfileView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
