export interface PostAuthorView {
  accountId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
}

export interface PostMediaView {
  id: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl: string;
  mediaId: string;
}

export interface PostView {
  id: string;
  authorId: string;
  content: string;
  media: PostMediaView[];
  createdAt: string;
  author: PostAuthorView | null;
  likesCount: number;
  commentsCount: number;
  visibility: "public" | "private";
  hashtags: string[];
  liked: boolean;
}

export interface SavePostMediaInput {
  mediaType: "image" | "video";
  mediaId: string;
}

export interface SavePostPayload {
  id?: string;
  content: string;
  media?: SavePostMediaInput[];
  visibility?: "public" | "private";
  hashtags?: string[];
}

export interface PostsListView {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PostLikeStatus {
  liked: Record<string, boolean>;
}

export interface PostLikeResult {
  likesCount: number;
}
