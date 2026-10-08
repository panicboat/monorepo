import type { MentionView } from "./post-view";

export interface CommentAuthorView {
  profileId: string;
  name: string;
  imageUrl: string;
  username: string;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  authorProfileId: string;
  content: string;
  createdAt: string;
  author: CommentAuthorView | null;
  repliesCount: number;
  mentions: MentionView[];
}

export interface PaginatedCommentsResponse {
  comments: CommentView[];
  nextCursor: string;
  hasMore: boolean;
}

export type { MentionView };
