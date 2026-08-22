import type { PostView } from "@/modules/post/lib/post-view";
import type { SocialAccountView } from "@/modules/social";

export type RankPeriodLiteral = "day" | "week" | "all";

export interface PaginatedUsersResponse {
  profiles: SocialAccountView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
