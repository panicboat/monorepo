import { CastPost, PostMedia, PostAuthor, PostsListResult } from "@/modules/social/types";
import type { MediaType } from "@/lib/types";

// API Response Types
interface ApiMedia {
  id?: string;
  mediaType?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface ApiAuthor {
  id?: string;
  name?: string;
  imageUrl?: string;
}

interface ApiPost {
  id?: string;
  castId?: string;
  content?: string;
  media?: ApiMedia[];
  createdAt?: string;
  author?: ApiAuthor;
  likesCount?: number;
  commentsCount?: number;
  visibility?: string;
  hashtags?: string[];
  liked?: boolean;
}

interface ApiPostsListResponse {
  posts?: ApiPost[];
  nextCursor?: string;
  hasMore?: boolean;
}

export function mapApiToPost(apiPost: ApiPost): CastPost {
  return {
    id: apiPost.id || "",
    castId: apiPost.castId || "",
    content: apiPost.content || "",
    media: (apiPost.media || []).map(mapApiToMedia),
    createdAt: apiPost.createdAt || "",
    author: apiPost.author ? mapApiToAuthor(apiPost.author) : undefined,
    likesCount: apiPost.likesCount || 0,
    commentsCount: apiPost.commentsCount || 0,
    visibility: (apiPost.visibility as "public" | "private") || "public",
    hashtags: apiPost.hashtags || [],
    liked: apiPost.liked || false,
  };
}

export function mapApiToMedia(apiMedia: ApiMedia): PostMedia {
  return {
    id: apiMedia.id,
    mediaType: (apiMedia.mediaType || "image") as MediaType,
    url: apiMedia.url || "",
    thumbnailUrl: apiMedia.thumbnailUrl,
  };
}

export function mapApiToAuthor(apiAuthor: ApiAuthor): PostAuthor {
  return {
    id: apiAuthor.id || "",
    name: apiAuthor.name || "",
    imageUrl: apiAuthor.imageUrl || "",
  };
}

export function mapApiToPostsList(apiResponse: ApiPostsListResponse): PostsListResult {
  const posts = (apiResponse.posts || []).map(mapApiToPost);
  return {
    items: posts,
    posts,
    nextCursor: apiResponse.nextCursor || "",
    hasMore: apiResponse.hasMore || false,
  };
}

export function mapMediaToApi(media: PostMedia[]) {
  return media.map((m) => ({
    mediaType: m.mediaType,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl || "",
  }));
}

export function mapPostToSavePayload(post: { id?: string; content: string; media: PostMedia[]; visibility?: "public" | "private"; hashtags?: string[] }) {
  return {
    id: post.id || "",
    content: post.content,
    media: mapMediaToApi(post.media),
    visibility: post.visibility || "public",
    hashtags: post.hashtags || [],
  };
}
