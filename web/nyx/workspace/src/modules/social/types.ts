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
};

export type PostsListResult = {
  posts: CastPost[];
  nextCursor: string;
  hasMore: boolean;
};
