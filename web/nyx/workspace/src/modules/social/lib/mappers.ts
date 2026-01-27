import { CastPost, PostMedia, PostAuthor, PostsListResult } from "@/modules/social/types";

export function mapApiToPost(apiPost: any): CastPost {
  return {
    id: apiPost.id || "",
    castId: apiPost.castId || "",
    content: apiPost.content || "",
    media: (apiPost.media || []).map(mapApiToMedia),
    createdAt: apiPost.createdAt || "",
    author: apiPost.author ? mapApiToAuthor(apiPost.author) : undefined,
    likesCount: apiPost.likesCount || 0,
    commentsCount: apiPost.commentsCount || 0,
    visible: apiPost.visible !== false,
  };
}

export function mapApiToMedia(apiMedia: any): PostMedia {
  return {
    id: apiMedia.id,
    mediaType: apiMedia.mediaType || "image",
    url: apiMedia.url || "",
    thumbnailUrl: apiMedia.thumbnailUrl,
  };
}

export function mapApiToAuthor(apiAuthor: any): PostAuthor {
  return {
    id: apiAuthor.id || "",
    name: apiAuthor.name || "",
    imageUrl: apiAuthor.imageUrl || "",
  };
}

export function mapApiToPostsList(apiResponse: any): PostsListResult {
  return {
    posts: (apiResponse.posts || []).map(mapApiToPost),
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

export function mapPostToSavePayload(post: { id?: string; content: string; media: PostMedia[]; visible?: boolean }) {
  return {
    id: post.id || "",
    content: post.content,
    media: mapMediaToApi(post.media),
    visible: post.visible !== false,
  };
}
