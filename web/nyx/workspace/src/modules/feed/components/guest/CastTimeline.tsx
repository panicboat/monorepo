"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Grid,
  List as ListIcon,
  Play,
} from "lucide-react";
import { useGuestTimeline, CastPost } from "@/modules/post";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils/date";

interface CastTimelineProps {
  castId: string;
}

type MediaItem = {
  mediaType: "image" | "video";
  url: string;
};

function MediaCarousel({ media }: { media: MediaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

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
    <div className="relative bg-black/5 rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {current.mediaType === "video" ? (
            <video
              src={current.url}
              className="w-full max-h-[300px] object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={current.url}
              alt="Post media"
              className="w-full max-h-[300px] object-cover"
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
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
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

function PostCard({ post }: { post: CastPost }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked) {
      setLikesCount((p) => p - 1);
    } else {
      setLikesCount((p) => p + 1);
    }
    setLiked(!liked);
  };

  const media: MediaItem[] = post.media.map((m) => ({
    mediaType: m.mediaType,
    url: m.url,
  }));

  return (
    <Link href={`/timeline/${post.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-info-light transition-colors cursor-pointer"
      >
        <p className="mb-3 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
          {post.content}
        </p>

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.hashtags.map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-xs bg-info-lighter text-info hover:bg-info-light"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {media.length > 0 && (
          <div className="mb-3">
            <MediaCarousel media={media} />
          </div>
        )}

        <div className="flex items-center justify-between text-text-muted">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              aria-label={liked ? "Unlike this post" : "Like this post"}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                liked ? "text-role-cast" : "text-text-muted hover:text-role-cast-light"
              }`}
            >
              <Heart aria-hidden="true" className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              <span>{likesCount}</span>
            </button>
            <span className="flex items-center gap-1.5 text-xs" aria-label={`${post.commentsCount} comments`}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              <span>{post.commentsCount}</span>
            </span>
          </div>
          <span className="text-xs text-text-muted">
            {formatTimeAgo(post.createdAt)}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

function GridView({ posts }: { posts: CastPost[] }) {
  const allMedia = posts.flatMap((post) =>
    post.media.map((m) => ({
      postId: post.id,
      mediaType: m.mediaType,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    }))
  );

  if (allMedia.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-sm">
        No media posts yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {allMedia.map((media, idx) => (
        <Link key={idx} href={`/timeline/${media.postId}`}>
          <div
            className="relative aspect-square bg-surface-secondary rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img
              src={media.mediaType === "video" ? media.thumbnailUrl || media.url : media.url}
              alt="media"
              className="w-full h-full object-cover"
            />
            {media.mediaType === "video" && (
              <div className="absolute top-2 right-2">
                <div className="bg-black/50 text-white rounded-full p-1 backdrop-blur-sm">
                  <Play size={10} fill="currentColor" />
                </div>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CastTimeline({ castId }: CastTimelineProps) {
  const { posts, loading, error, hasMore, fetchPosts, loadMore } =
    useGuestTimeline({ castId });
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

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
  }, [hasMore, loading, loadMore]);

  const isInitialLoading = loading && posts.length === 0;

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-text-primary">Posts</h3>
        <div className="flex bg-surface-secondary rounded-lg p-0.5" role="tablist" aria-label="Layout options">
          <button
            onClick={() => setLayout("list")}
            role="tab"
            aria-selected={layout === "list"}
            aria-label="List view"
            className={`p-1.5 rounded-md transition-all ${
              layout === "list" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"
            }`}
          >
            <ListIcon aria-hidden="true" size={16} />
          </button>
          <button
            onClick={() => setLayout("grid")}
            role="tab"
            aria-selected={layout === "grid"}
            aria-label="Grid view"
            className={`p-1.5 rounded-md transition-all ${
              layout === "grid" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"
            }`}
          >
            <Grid aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isInitialLoading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-text-muted" />
          <span className="text-sm text-text-muted">Loading posts...</span>
        </div>
      ) : error ? (
        <div className="py-10 text-center text-error text-sm">
          Failed to load posts. Please try again.
        </div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center text-text-muted text-sm">
          No posts yet
        </div>
      ) : layout === "list" ? (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {hasMore && (
            <div ref={loadMoreRef} className="pt-4 text-center">
              {loading && (
                <div className="flex items-center justify-center gap-2 text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <GridView posts={posts} />
          {hasMore && (
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
      )}
    </div>
  );
}
