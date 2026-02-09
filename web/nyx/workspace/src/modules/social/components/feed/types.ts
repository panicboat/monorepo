import { CastPost } from "@/modules/social/types";
import { formatTimeAgo } from "@/lib/utils/date";
import { Media, MediaType } from "@/lib/types";

// Re-export for backwards compatibility
export type FeedMediaItem = Media;

export type FeedItem = {
  id: string;
  castId: string;
  castName: string;
  castImage: string;
  content: string;
  time: string;
  media?: Media[];
  mediaUrl?: string;
  mediaType?: MediaType;
  image?: string; // Legacy support
  likes: number;
  comments: number;
  visibility?: "public" | "private";
  hashtags?: string[];
  liked?: boolean;
};

export function mapPostToFeedItem(post: CastPost): FeedItem {
  return {
    id: post.id,
    castId: post.castId,
    castName: post.author?.name || "Unknown",
    castImage: post.author?.imageUrl || "",
    content: post.content,
    time: formatTimeAgo(post.createdAt),
    media: post.media.map((m) => ({
      mediaType: m.mediaType,
      url: m.url,
    })),
    likes: post.likesCount,
    comments: post.commentsCount,
    visibility: post.visibility,
    hashtags: post.hashtags,
    liked: post.liked,
  };
}
