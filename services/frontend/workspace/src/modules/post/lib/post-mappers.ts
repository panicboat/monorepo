import type {
  Post,
  PostAuthor,
  PostMedia,
} from "@/stub/post/v1/post_service_pb";
import type {
  PostAuthorView,
  PostMediaView,
  PostView,
  PostsListView,
  SavePostPayload,
} from "@/modules/post/lib/post-view";

export function mapPostAuthorToView(a: PostAuthor | undefined): PostAuthorView | null {
  if (!a) return null;
  return {
    accountId: a.accountId || "",
    displayName: a.displayName || "",
    username: a.username || "",
    avatarUrl: a.avatarUrl || "",
  };
}

export function mapPostMediaToView(m: PostMedia): PostMediaView {
  const t = (m.mediaType || "image") as "image" | "video";
  return {
    id: m.id || "",
    mediaType: t === "video" ? "video" : "image",
    url: m.url || "",
    thumbnailUrl: m.thumbnailUrl || "",
    mediaId: m.mediaId || "",
  };
}

export function mapPostToView(p: Post): PostView {
  const v = (p.visibility || "public").toLowerCase();
  return {
    id: p.id,
    authorId: p.authorId || "",
    content: p.content || "",
    media: (p.media || []).map(mapPostMediaToView),
    createdAt: p.createdAt || "",
    author: mapPostAuthorToView(p.author),
    likesCount: p.likesCount || 0,
    commentsCount: p.commentsCount || 0,
    visibility: v === "private" ? "private" : "public",
    hashtags: p.hashtags || [],
    liked: p.liked || false,
  };
}

export function mapPostsListResponse(res: {
  posts: Post[];
  nextCursor: string;
  hasMore: boolean;
}): PostsListView {
  return {
    posts: (res.posts || []).map(mapPostToView),
    nextCursor: res.nextCursor || "",
    hasMore: res.hasMore || false,
  };
}

export function buildSavePostRequest(payload: SavePostPayload) {
  return {
    id: payload.id || "",
    content: payload.content,
    media: (payload.media || []).map((m) => ({
      id: "",
      mediaType: m.mediaType,
      url: "",
      thumbnailUrl: "",
      mediaId: m.mediaId,
    })),
    visibility: payload.visibility || "public",
    hashtags: payload.hashtags || [],
  };
}
