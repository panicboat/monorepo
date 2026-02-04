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
import { useGuestTimeline } from "@/modules/social/hooks/useGuestTimeline";
import { Badge } from "@/components/ui/Badge";
import { CastPost } from "@/modules/social/types";
import Link from "next/link";

interface CastTimelineProps {
  castId: string;
}

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
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
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
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 transition-colors cursor-pointer"
      >
        <p className="mb-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
          {post.content}
        </p>

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.hashtags.map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-xs bg-blue-50 text-blue-500 hover:bg-blue-100"
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

        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                liked ? "text-pink-500" : "text-slate-400 hover:text-pink-300"
              }`}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              <span>{likesCount}</span>
            </button>
            <span className="flex items-center gap-1.5 text-xs">
              <MessageCircle className="h-4 w-4" />
              <span>{post.commentsCount}</span>
            </span>
          </div>
          <span className="text-xs text-slate-400">
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
      <div className="py-8 text-center text-slate-400 text-sm">
        No media posts yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {allMedia.map((media, idx) => (
        <Link key={idx} href={`/timeline/${media.postId}`}>
          <div
            className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
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
        <h3 className="text-lg font-bold text-slate-800">Posts</h3>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setLayout("list")}
            className={`p-1.5 rounded-md transition-all ${
              layout === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
            }`}
          >
            <ListIcon size={16} />
          </button>
          <button
            onClick={() => setLayout("grid")}
            className={`p-1.5 rounded-md transition-all ${
              layout === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
            }`}
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isInitialLoading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
          <span className="text-sm text-slate-400">Loading posts...</span>
        </div>
      ) : error ? (
        <div className="py-10 text-center text-red-400 text-sm">
          Failed to load posts. Please try again.
        </div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
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
                <div className="flex items-center justify-center gap-2 text-slate-400">
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
                <div className="flex items-center justify-center gap-2 text-slate-400">
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
