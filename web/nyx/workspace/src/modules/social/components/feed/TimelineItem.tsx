"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Heart, MessageCircle, Trash2, Lock, LockOpen } from "lucide-react";
import { slideUpFadeVariants, popVariants, popTransition } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useLike } from "@/modules/social/hooks/useLike";
import { useAuthStore } from "@/stores/authStore";
import { FeedItem, FeedMediaItem } from "./types";
import { MediaCarousel } from "./MediaCarousel";

interface TimelineItemProps {
  item: FeedItem;
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, visibility: "public" | "private") => void;
  onClick?: () => void;
}

export function TimelineItem({
  item,
  mode = "guest",
  onDelete,
  onToggleVisibility,
  onClick,
}: TimelineItemProps) {
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

  const isHidden = item.visibility === "private";

  // Resolve media: prefer new `media` array, fall back to legacy single fields
  const resolvedMedia: FeedMediaItem[] = item.media && item.media.length > 0
    ? item.media
    : item.mediaUrl
      ? [{ mediaType: item.mediaType || "image", url: item.mediaUrl }]
      : [];

  return (
    <motion.div
      variants={slideUpFadeVariants}
      initial="hidden"
      animate="visible"
      layout
      onClick={onClick}
      className={`rounded-2xl border p-4 shadow-sm relative group ${
        isHidden
          ? "border-dashed border-border-secondary bg-surface-secondary/80 opacity-60"
          : "border-border bg-surface"
      } ${onClick ? "cursor-pointer hover:border-info-light transition-colors" : ""}`}
    >
      <div className="mb-3 flex items-center gap-3">
        {mode === "guest" ? (
          <Link
            href={`/casts/${item.castId}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {item.castImage ? (
              <img
                src={item.castImage}
                alt={item.castName}
                className="h-10 w-10 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full border border-border bg-border shrink-0" />
            )}
            <div>
              <div className="font-bold text-text-primary">{item.castName}</div>
              <div className="text-xs text-text-muted">{item.time}</div>
            </div>
          </Link>
        ) : (
          <>
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
          </>
        )}
        {mode === "cast" && (
          <div className="absolute top-2 right-2 flex gap-1">
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(item.id, isHidden ? "public" : "private");
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
            variants={popVariants}
            initial="initial"
            animate="animate"
            transition={popTransition}
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
}
