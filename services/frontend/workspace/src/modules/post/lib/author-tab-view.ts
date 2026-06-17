import type { CommentView } from "./comment-view";
import type { PostView } from "./post-view";

export type ProfileTabKind = "posts" | "replies" | "media" | "likes";

export interface PaginatedAuthorPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedAuthorCommentsResponse {
  comments: CommentView[];
  postsById: Record<string, PostView>;
  nextCursor: string;
  hasMore: boolean;
}
