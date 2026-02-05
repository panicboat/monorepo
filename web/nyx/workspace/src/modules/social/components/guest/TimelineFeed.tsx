"use client";

import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, Trash2, Lock, LockOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useSocial } from "@/modules/social/hooks/useSocial";
import { useGuestTimeline } from "@/modules/social/hooks/useGuestTimeline";
import { useLike } from "@/modules/social/hooks/useLike";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CastPost } from "@/modules/social/types";
import { useAuthStore } from "@/stores/authStore";

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
    liked: post.liked,
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
  const { favorites, isLoaded } = useSocial();
  const { posts, loading, error, hasMore, fetchPosts, loadMore, setPosts } = useGuestTimeline();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // Fetch posts on mount (only in guest mode without items prop)
  // Wait for hydration to complete so auth token is available
  useEffect(() => {
    if (mode === "guest" && !items && isHydrated) {
      fetchPosts();
    }
  }, [mode, items, fetchPosts, isHydrated]);

  // Handle filter change - refetch with server-side filtering for "following"
  const handleFilterChange = useCallback(async (newFilter: "all" | "following" | "favorites") => {
    setFilter(newFilter);

    // For "following" filter, we need to refetch from server with filter param
    if (mode === "guest" && !items && newFilter === "following" && isAuthenticated()) {
      // Clear current posts and fetch filtered
      setPosts([]);
      await fetchPosts(undefined, "following");
    } else if (mode === "guest" && !items && newFilter === "all") {
      // Refetch all posts
      setPosts([]);
      await fetchPosts();
    }
    // "favorites" filter is handled client-side
  }, [mode, items, isAuthenticated, fetchPosts, setPosts]);

  // Infinite scroll
  useEffect(() => {
    if (mode !== "guest" || items || !loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore(filter === "following" ? "following" : undefined);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [mode, items, hasMore, loading, loadMore, filter]);

  // Convert API posts to FeedItem format, or use provided items
  const sourceFeed: FeedItem[] = items || posts.map(mapPostToFeedItem);

  // Client-side filtering for favorites (server handles following)
  const filteredFeed = sourceFeed.filter((item: FeedItem) => {
    if (mode === "cast") return true; // Show all (own) posts in cast mode
    if (filter === "all" || filter === "following") return true; // Server handles following filter
    if (filter === "favorites") return favorites.includes(item.castId);
    return true;
  });

  const isInitialLoading = loading && posts.length === 0;

  return (
    <div className="space-y-4 py-4 min-h-screen">
      {mode === "guest" && (
        <div className="px-4 flex items-center justify-between">
          <h2 className="text-lg font-bold font-serif text-text-primary">
            Timeline
          </h2>

          {/* Filter Tabs */}
          <div className="flex bg-surface-secondary p-1 rounded-lg" role="tablist" aria-label="Timeline filters">
            {(["all", "following", "favorites"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                role="tab"
                aria-selected={filter === tab}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filter === tab
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 px-4 pb-20">
        {isInitialLoading || (!items && !isLoaded) ? (
          <div className="py-10 text-center text-text-muted text-sm">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-error text-sm">
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
                  <div className="flex items-center justify-center gap-2 text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-text-muted text-sm">
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
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <button
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1" role="tablist" aria-label="Image navigation">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={(e) => goTo(e, i)}
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={`Go to image ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? "bg-surface" : "bg-surface/50"
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
  const [liked, setLiked] = useState(item.liked ?? false);
  const [likesCount, setLikesCount] = useState(item.likes);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const { toggleLike } = useLike();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Sync with item prop changes
  useEffect(() => {
    setLiked(item.liked ?? false);
    setLikesCount(item.likes);
  }, [item.liked, item.likes]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If not authenticated, just do optimistic update (will be lost on refresh)
    if (!isAuthenticated()) {
      if (liked) {
        setLikesCount((p) => p - 1);
      } else {
        setLikesCount((p) => p + 1);
      }
      setLiked(!liked);
      return;
    }

    // Optimistic update
    const wasLiked = liked;
    const prevCount = likesCount;
    setLiked(!wasLiked);
    setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);

    setIsLikeLoading(true);
    try {
      const newCount = await toggleLike(item.id, wasLiked);
      if (newCount !== null) {
        setLikesCount(newCount);
      }
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikesCount(prevCount);
    } finally {
      setIsLikeLoading(false);
    }
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
          ? "border-dashed border-border-secondary bg-surface-secondary/80 opacity-60"
          : "border-border bg-surface"
      } ${onClick ? "cursor-pointer hover:border-info-light transition-colors" : ""}`}
    >
      <div className="mb-3 flex items-center gap-3">
        {item.castImage ? (
          <img
            src={item.castImage}
            alt={item.castName}
            className="h-10 w-10 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full border border-border bg-border shrink-0" />
        )}
        <div className="flex items-center gap-2">
          <div>
            <div className="font-bold text-text-primary">{item.castName}</div>
            <div className="text-xs text-text-muted">{item.time}</div>
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
                className={`gap-1 text-xs ${isHidden ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-text-muted hover:text-text-secondary hover:bg-surface-secondary"}`}
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
                className="text-text-muted hover:text-error hover:bg-error-lighter"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mb-3 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
        {item.content}
      </p>
      {item.hashtags && item.hashtags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {item.hashtags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs bg-info-lighter text-info hover:bg-info-light">
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
      <div className="flex items-center gap-6 border-t border-border pt-3 text-text-muted">
        <button
          onClick={handleLike}
          disabled={isLikeLoading || mode === "cast"}
          aria-label={liked ? "Unlike this post" : "Like this post"}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-role-cast" : "text-text-muted hover:text-role-cast-light"} ${isLikeLoading || mode === "cast" ? "opacity-50 cursor-default hover:text-text-muted" : ""}`}
        >
          <motion.div
            key={liked ? "liked" : "unliked"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Heart aria-hidden="true" className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </motion.div>
          <span>{likesCount}</span>
        </button>
        <button aria-label={`View ${item.comments} comments`} className="flex items-center gap-1.5 text-xs hover:text-special transition-colors">
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          <span>{item.comments}</span>
        </button>
      </div>
    </motion.div>
  );
};
