/**
 * Proto の Post オブジェクトを API レスポンス用 JSON にマッピング。
 * API route (BFF) で使用。クライアントサイドの mappers.ts とは別。
 */

interface ProtoMedia {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl: string;
}

interface ProtoAuthor {
  id: string;
  name: string;
  imageUrl: string;
}

interface ProtoPost {
  id: string;
  castId: string;
  content: string;
  media: ProtoMedia[];
  createdAt: string;
  author?: ProtoAuthor | null;
  likesCount: number;
  commentsCount: number;
  visibility: string;
  hashtags: string[];
  liked: boolean;
}

export function mapProtoPostToJson(post: ProtoPost) {
  return {
    id: post.id,
    castId: post.castId,
    content: post.content,
    media: post.media.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    })),
    createdAt: post.createdAt,
    author: post.author
      ? {
          id: post.author.id,
          name: post.author.name,
          imageUrl: post.author.imageUrl,
        }
      : null,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    visibility: post.visibility,
    hashtags: post.hashtags,
    liked: post.liked,
  };
}

export function mapProtoPostsListToJson(response: {
  posts: ProtoPost[];
  nextCursor: string;
  hasMore: boolean;
}) {
  return {
    posts: response.posts.map(mapProtoPostToJson),
    nextCursor: response.nextCursor,
    hasMore: response.hasMore,
  };
}
