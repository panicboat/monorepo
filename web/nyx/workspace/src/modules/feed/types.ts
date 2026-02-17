// Feed module types

// Re-export post types since feed displays posts
export type { CastPost, PostMedia, PostAuthor } from "@/modules/post/types";

export type FeedFilter = "all" | "following" | "favorites";

export interface FeedResult {
  posts: import("@/modules/post/types").CastPost[];
  nextCursor: string;
  hasMore: boolean;
}

export interface FeedAuthor {
  id: string;
  name: string;
  imageUrl: string;
}
