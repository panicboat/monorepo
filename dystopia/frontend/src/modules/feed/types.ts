import type { PostView } from "@/modules/post/lib/post-view";

export type FeedFilterValue = "all" | "area" | "following" | "followers";

export interface FeedListView {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UseFeedOptions {
  filter?: FeedFilterValue;
  prefecture?: string;
}
