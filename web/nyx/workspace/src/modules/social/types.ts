/**
 * Social Module Types
 *
 * Types for posts, comments, and social interactions.
 */

import type { Media, Author, AuthorWithType, PaginatedResponse } from "@/lib/types";

// Re-export base types for convenience
export type { Media as PostMedia, Media as CommentMedia };
export type { Author as PostAuthor };
export type { AuthorWithType as CommentAuthor };

// =============================================================================
// Post Types
// =============================================================================

export type CastPost = {
  id: string;
  castId: string;
  content: string;
  media: Media[];
  createdAt: string;
  author?: Author;
  likesCount: number;
  commentsCount: number;
  visible: boolean;
  hashtags: string[];
  liked: boolean;
};

export type PostsListResult = PaginatedResponse<CastPost> & {
  posts: CastPost[]; // Alias for backwards compatibility
};

// =============================================================================
// Comment Types
// =============================================================================

export type Comment = {
  id: string;
  postId: string;
  parentId: string;
  userId: string;
  content: string;
  createdAt: string;
  author?: AuthorWithType;
  media: Media[];
  repliesCount: number;
};

export type CommentsListResult = PaginatedResponse<Comment> & {
  comments: Comment[]; // Alias for backwards compatibility
};

export type RepliesListResult = PaginatedResponse<Comment> & {
  replies: Comment[]; // Alias for backwards compatibility
};

export type AddCommentResult = {
  comment: Comment | null;
  commentsCount: number;
};

export type DeleteCommentResult = {
  commentsCount: number;
};

// =============================================================================
// Like Types
// =============================================================================

export type LikeState = {
  liked: boolean;
  likesCount: number;
};

export type LikeResult = {
  success: boolean;
  likesCount: number;
};

// =============================================================================
// Follow Types
// =============================================================================

export type FollowState = Record<string, boolean>;

export type FollowResult = {
  success: boolean;
  isFollowing: boolean;
};
