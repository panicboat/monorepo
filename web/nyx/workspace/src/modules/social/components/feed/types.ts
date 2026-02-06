import { CastPost } from "@/modules/social/types";
import { formatTimeAgo } from "@/lib/utils/date";

export type FeedMediaItem = {
  mediaType: "image" | "video";
  url: string;
};

export type FeedItem = {
  id: string;
  castId: string;
  castName: string;
  castImage: string;
  content: string;
  time: string;
  media?: FeedMediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  image?: string; // Legacy support
  likes: number;
  comments: number;
  visible?: boolean;
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
    visible: post.visible,
    hashtags: post.hashtags,
    liked: post.liked,
  };
}
