"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Heart, MessageCircle, Share2, Loader2, ChevronRight } from "lucide-react";
import { useGuestPost } from "@/modules/social/hooks/useGuestTimeline";
import { Badge } from "@/components/ui/Badge";

type MediaItem = {
  mediaType: "image" | "video";
  url: string;
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
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-sm transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-sm transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
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

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { post, loading, error, fetchPost } = useGuestPost(id);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  useEffect(() => {
    if (post) {
      setLikesCount(post.likesCount);
    }
  }, [post]);

  const handleLike = () => {
    if (liked) {
      setLikesCount((p) => p - 1);
    } else {
      setLikesCount((p) => p + 1);
    }
    setLiked(!liked);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-lg">Post</h1>
        </div>
        <div className="p-8 text-center text-slate-400">
          <p className="mb-4">Post not found</p>
          <button
            onClick={() => router.back()}
            className="text-blue-400 hover:text-blue-500 font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const media: MediaItem[] = post.media.map((m) => ({
    mediaType: m.mediaType,
    url: m.url,
  }));

  return (
    <div className="min-h-screen bg-white pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 rounded-full hover:bg-slate-100 transition-colors"
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
          {post.author?.imageUrl ? (
            <img
              src={post.author.imageUrl}
              alt={post.author.name}
              className="h-12 w-12 rounded-full border border-slate-100 object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-slate-200 border border-slate-100" />
          )}
          <div>
            <div className="font-bold text-slate-800">{post.author?.name || "Unknown"}</div>
            <div className="text-sm text-slate-400">{formatTimeAgo(post.createdAt)}</div>
          </div>
        </Link>

        {/* Content */}
        <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-sm bg-blue-50 text-blue-500 hover:bg-blue-100">
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
        <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 transition-colors ${
              liked ? "text-pink-500" : "text-slate-400 hover:text-pink-300"
            }`}
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
          <button className="flex items-center gap-2 text-slate-400 hover:text-indigo-500 transition-colors">
            <MessageCircle className="h-6 w-6" />
            <span className="font-medium">{post.commentsCount}</span>
          </button>
          <button className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors ml-auto">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
