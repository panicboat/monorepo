"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Heart, MessageCircle, Share2, Loader2, ChevronRight } from "lucide-react";
import { useGuestPost } from "@/modules/social/hooks/useGuestTimeline";
import { useLike } from "@/modules/social/hooks/useLike";
import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/Badge";
import { CommentSection } from "@/modules/social/components/comments";
import { formatTimeAgo } from "@/lib/utils/date";
import type { Media } from "@/lib/types";

function MediaCarousel({ media }: { media: Media[] }) {
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
    <div className="relative bg-black/5 rounded-2xl overflow-hidden">
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
              className="w-full max-h-[500px] object-contain"
              controls
              autoPlay
              muted
              playsInline
            />
          ) : (
            <img
              src={current.url}
              alt="Post media"
              className="w-full max-h-[500px] object-contain"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {media.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-2 shadow-sm transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-2 shadow-sm transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
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

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { post, loading, error, fetchPost } = useGuestPost(id);
  const { toggleLike } = useLike();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  useEffect(() => {
    if (post) {
      setLikesCount(post.likesCount);
      setLiked(post.liked);
    }
  }, [post]);

  const handleLike = async () => {
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
      const newCount = await toggleLike(id, wasLiked);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-info" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-lg">Post</h1>
        </div>
        <div className="p-8 text-center text-text-muted">
          <p className="mb-4">Post not found</p>
          <button
            onClick={() => router.back()}
            className="text-info hover:text-info font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const media: Media[] = post.media.map((m) => ({
    mediaType: m.mediaType,
    url: m.url,
  }));

  return (
    <div className="min-h-screen bg-surface pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 rounded-full hover:bg-surface-secondary transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-lg">Post</h1>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Author */}
        <Link
          href={`/casts/${post.castId}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {post.author?.imageUrl && post.author.imageUrl.trim() !== "" ? (
            <img
              src={post.author.imageUrl}
              alt={post.author.name || ""}
              className="h-12 w-12 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-border border border-border" />
          )}
          <div>
            <div className="font-bold text-text-primary">{post.author?.name || "Unknown"}</div>
            <div className="text-sm text-text-muted">{formatTimeAgo(post.createdAt)}</div>
          </div>
        </Link>

        {/* Content */}
        <p className="text-base leading-relaxed text-text-secondary whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-sm bg-info-lighter text-info hover:bg-info-light">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Media */}
        {media.length > 0 && (
          <MediaCarousel media={media} />
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 pt-4 border-t border-border">
          <button
            onClick={handleLike}
            disabled={isLikeLoading}
            className={`flex items-center gap-2 transition-colors ${
              liked ? "text-role-cast" : "text-text-muted hover:text-role-cast-light"
            } ${isLikeLoading ? "opacity-50" : ""}`}
          >
            <motion.div
              key={liked ? "liked" : "unliked"}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Heart className={`h-6 w-6 ${liked ? "fill-current" : ""}`} />
            </motion.div>
            <span className="font-medium">{likesCount}</span>
          </button>
          <button className="flex items-center gap-2 text-text-muted hover:text-special transition-colors">
            <MessageCircle className="h-6 w-6" />
            <span className="font-medium">{post.commentsCount}</span>
          </button>
          <button className="flex items-center gap-2 text-text-muted hover:text-info transition-colors ml-auto">
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Comments Section */}
        <CommentSection postId={id} commentsCount={post.commentsCount} />
      </div>
    </div>
  );
}
