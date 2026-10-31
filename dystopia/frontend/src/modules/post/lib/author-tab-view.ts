import type { PostView } from "./post-view";

export type ProfileTabKind = "posts" | "media" | "likes";

export interface PaginatedAuthorPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
