export type PostMedia = {
  id?: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl?: string;
};

export type PostAuthor = {
  id: string;
  name: string;
  imageUrl: string;
};

export type CastPost = {
  id: string;
  castId: string;
  content: string;
  media: PostMedia[];
  createdAt: string;
  author?: PostAuthor;
  likesCount: number;
  commentsCount: number;
  visible: boolean;
  hashtags: string[];
  liked: boolean;
};

export type PostsListResult = {
  posts: CastPost[];
  nextCursor: string;
  hasMore: boolean;
};

export type CommentMedia = {
  id?: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl?: string;
};

export type CommentAuthor = {
  id: string;
  name: string;
  imageUrl: string;
  userType: "guest" | "cast";
};

export type Comment = {
  id: string;
  postId: string;
  parentId: string;
  userId: string;
  content: string;
  createdAt: string;
  author?: CommentAuthor;
  media: CommentMedia[];
  repliesCount: number;
};

export type CommentsListResult = {
  comments: Comment[];
  nextCursor: string;
  hasMore: boolean;
};

export type RepliesListResult = {
  replies: Comment[];
  nextCursor: string;
  hasMore: boolean;
};

export type AddCommentResult = {
  comment: Comment | null;
  commentsCount: number;
};

export type DeleteCommentResult = {
  commentsCount: number;
};
