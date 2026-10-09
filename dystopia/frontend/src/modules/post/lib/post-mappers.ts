import type {
  Post,
  PostAuthor,
  PostMedia,
  PostMention,
} from "@/stub/post/v1/post_service_pb";
import type {
  MentionView,
  PostAuthorView,
  PostMediaView,
  PostView,
  PostsListView,
  SavePostPayload,
} from "@/modules/post/lib/post-view";

export function mapMentionToView(m: PostMention): MentionView {
  return {
    profileId: m.profileId || "",
    username: m.username || "",
    position: m.position || 0,
    length: m.length || 0,
  };
}

export function mapPostAuthorToView(a: PostAuthor | undefined): PostAuthorView | null {
  if (!a) return null;
  return {
    profileId: a.profileId || "",
    displayName: a.displayName || "",
    username: a.username || "",
    avatarUrl: a.avatarUrl || "",
  };
}

export function mapPostMediaToView(m: PostMedia): PostMediaView {
  return {
    id: m.id || "",
    mediaType: m.mediaType === "video" ? "video" : "image",
    url: m.url || "",
    thumbnailUrl: m.thumbnailUrl || "",
    mediaId: m.mediaId || "",
  };
}

export function mapPostToView(p: Post): PostView {
  return {
    id: p.id || "",
    authorProfileId: p.authorProfileId || "",
    content: p.content || "",
    media: (p.media || []).map(mapPostMediaToView),
    createdAt: p.createdAt || "",
    author: mapPostAuthorToView(p.author),
    likesCount: p.likesCount || 0,
    commentsCount: p.commentsCount || 0,
    visibility: (p.visibility || "").toLowerCase() === "private" ? "private" : "public",
    hashtags: p.hashtags || [],
    mentions: (p.mentions || []).map(mapMentionToView),
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
    nextCursor: res.nextCursor || null,
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
