import type { PostView } from "@/modules/post/lib/post-view";
import type { ProfileSummaryView } from "@/modules/profile/types";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";

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

export type ScheduleTimeBand = "" | "day" | "evening" | "night";

export interface ScheduleSearchFilters {
  date: string;
  prefecture: string;
  area: string;
  industry: string;
  timeBand: ScheduleTimeBand;
  followingOnly: boolean;
  query: string;
}

export interface PaginatedSchedulesResponse {
  results: ScheduleSearchResultView[];
  nextCursor: string;
  hasMore: boolean;
}
