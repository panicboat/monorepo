export interface CommentAuthorView {
  userId: string;
  name: string;
  imageUrl: string;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  content: string;
  createdAt: string;
  author: CommentAuthorView | null;
  repliesCount: number;
}

export interface PaginatedCommentsResponse {
  comments: CommentView[];
  nextCursor: string;
  hasMore: boolean;
}
