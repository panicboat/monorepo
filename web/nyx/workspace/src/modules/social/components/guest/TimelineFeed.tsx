"use client";

import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, Trash2, Lock, LockOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useSocial } from "@/modules/social/hooks/useSocial";
import { useGuestTimeline } from "@/modules/social/hooks/useGuestTimeline";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CastPost } from "@/modules/social/types";

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
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function mapPostToFeedItem(post: CastPost): FeedItem {
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
  };
}

type TimelineFeedProps = {
  items?: FeedItem[];
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onItemClick?: (id: string) => void;
};

export const TimelineFeed = ({
  items,
  mode = "guest",
  onDelete,
  onToggleVisibility,
  onItemClick,
}: TimelineFeedProps) => {
  const [filter, setFilter] = useState<"all" | "following" | "favorites">(
    "all",
  );
  const { following, favorites, isLoaded } = useSocial();
  const { posts, loading, error, hasMore, fetchPosts, loadMore } = useGuestTimeline();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch posts on mount (only in guest mode without items prop)
  useEffect(() => {
    if (mode === "guest" && !items) {
      fetchPosts();
    }
  }, [mode, items, fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    if (mode !== "guest" || items || !loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [mode, items, hasMore, loading, loadMore]);

  // Convert API posts to FeedItem format, or use provided items
  const sourceFeed: FeedItem[] = items || posts.map(mapPostToFeedItem);

  const filteredFeed = sourceFeed.filter((item: FeedItem) => {
    if (mode === "cast") return true; // Show all (own) posts in cast mode
    if (filter === "all") return true;
    if (filter === "following") return following.includes(item.castId);
    if (filter === "favorites") return favorites.includes(item.castId);
    return true;
  });

  const isInitialLoading = loading && posts.length === 0;

  return (
    <div className="space-y-4 py-4 min-h-screen">
      {mode === "guest" && (
        <div className="px-4 flex items-center justify-between">
          <h2 className="text-lg font-bold font-serif text-slate-800">
            Timeline
          </h2>

          {/* Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(["all", "following", "favorites"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filter === tab
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 px-4 pb-20">
        {isInitialLoading || (!items && !isLoaded) ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-400 text-sm">
            Failed to load posts. Please try again.
          </div>
        ) : filteredFeed.length > 0 ? (
          <>
            {filteredFeed.map((item: FeedItem) => (
              <TimelineItem
                key={item.id}
                item={item}
                mode={mode}
                onDelete={onDelete}
                onToggleVisibility={onToggleVisibility}
                onClick={() => onItemClick?.(item.id)}
              />
            ))}
            {mode === "guest" && !items && hasMore && (
              <div ref={loadMoreRef} className="pt-4 text-center">
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-slate-400 text-sm">
            {mode === "cast"
              ? "No posts yet. Share something!"
              : filter === "all"
                ? "No posts yet."
                : filter === "following"
                  ? "You are not following anyone yet."
                  : "No favorites yet."}
          </div>
        )}
      </div>
    </div>
  );
};

function MediaCarousel({ media, onClick }: { media: FeedMediaItem[]; onClick?: (e: React.MouseEvent) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goTo = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : media.length - 1));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i < media.length - 1 ? i + 1 : 0));
  };

  const current = media[currentIndex];

  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-black/5 relative" onClick={onClick}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {current.mediaType === "video" ? (
            <>
              <video
                src={current.url}
                className="h-full w-full object-cover max-h-[400px]"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                GIF Preview
              </div>
            </>
          ) : (
            <img
              src={current.url}
              alt="Post"
              className="h-full w-full object-cover max-h-[400px]"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {media.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={(e) => goTo(e, i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const TimelineItem = ({
  item,
  mode = "guest",
  onDelete,
  onToggleVisibility,
  onClick,
}: {
  item: FeedItem;
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onClick?: () => void;
}) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) {
      setLikesCount((p) => p - 1);
    } else {
      setLikesCount((p) => p + 1);
    }
    setLiked(!liked);
  };

  const isHidden = item.visible === false;

  // Resolve media: prefer new `media` array, fall back to legacy single fields
  const resolvedMedia: FeedMediaItem[] = item.media && item.media.length > 0
    ? item.media
    : item.mediaUrl
      ? [{ mediaType: item.mediaType || "image", url: item.mediaUrl }]
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onClick={onClick}
      className={`rounded-2xl border p-4 shadow-sm relative group ${
        isHidden
          ? "border-dashed border-slate-300 bg-slate-50/80 opacity-60"
          : "border-slate-100 bg-white"
      } ${onClick ? "cursor-pointer hover:border-blue-200 transition-colors" : ""}`}
    >
      <div className="mb-3 flex items-center gap-3">
        {item.castImage ? (
          <img
            src={item.castImage}
            alt={item.castName}
            className="h-10 w-10 rounded-full border border-slate-100 object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full border border-slate-100 bg-slate-200 shrink-0" />
        )}
        <div className="flex items-center gap-2">
          <div>
            <div className="font-bold text-slate-800">{item.castName}</div>
            <div className="text-xs text-slate-400">{item.time}</div>
          </div>
        </div>
        {mode === "cast" && (
          <div className="absolute top-2 right-2 flex gap-1">
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(item.id, isHidden);
                }}
                title={isHidden ? "Make this post public" : "Hide this post from guests"}
                className={`gap-1 text-xs ${isHidden ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
              >
                {isHidden ? <Lock size={14} /> : <LockOpen size={14} />}
                <span>{isHidden ? "Private" : "Public"}</span>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                title="Delete this post"
                className="text-slate-300 hover:text-red-500 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
        {item.content}
      </p>
      {item.hashtags && item.hashtags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {item.hashtags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs bg-blue-50 text-blue-500 hover:bg-blue-100">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
      {resolvedMedia.length > 0 && (
        <MediaCarousel media={resolvedMedia} />
      )}
      {resolvedMedia.length === 0 && item.image && (
        <div className="mb-3 overflow-hidden rounded-xl">
          <img
            src={item.image}
            alt="Post"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-6 border-t border-slate-50 pt-3 text-slate-400">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-pink-500" : "text-slate-400 hover:text-pink-300"}`}
        >
          <motion.div
            key={liked ? "liked" : "unliked"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </motion.div>
          <span>{likesCount}</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-indigo-500 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span>{item.comments}</span>
        </button>
      </div>
    </motion.div>
  );
};
