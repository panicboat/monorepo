"use client";

import { motion } from "motion/react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { useSocial } from "@/modules/social/hooks/useSocial";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export type FeedItem = {
  id: string;
  castId: string;
  castName: string;
  castImage: string;
  content: string;
  time: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  image?: string; // Legacy support
  likes: number;
  comments: number;
};

// Mock "Tweet-like" activities
export const feed: FeedItem[] = [
  {
    id: "1",
    castId: "1",
    castName: "Yuna",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content:
      "Just finished a wonderful ritual! 🕯️ Thank you for the pledge. Tonight I still have 1 slot open at 23:00.",
    time: "10m ago",
    likes: 24,
    comments: 2,
  },
  {
    id: "2",
    castId: "4",
    castName: "Mio",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    content: "New cosplay arrived! 👗 Can't wait to show you all.",
    time: "30m ago",
    mediaUrl: "https://placehold.co/600x400/rose/white?text=Cosplay+Teaser",
    mediaType: "image",
    likes: 156,
    comments: 12,
  },
  {
    id: "3",
    castId: "5",
    castName: "Rin",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    content:
      "Rainy days are for deep conversations... ☔ Anyone up for a chat?",
    time: "1h ago",
    likes: 42,
    comments: 5,
  },
  {
    id: "4",
    castId: "3",
    castName: "Sarah",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "Check out this view from my morning walk! 🌸",
    time: "4h ago",
    mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    mediaType: "video",
    likes: 89,
    comments: 8,
  },
  {
    id: "5",
    castId: "6",
    castName: "Kila",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila",
    content: "Listening to jazz and drinking coffee. Recommendations? ☕",
    time: "5h ago",
    likes: 33,
    comments: 14,
  },
];

type TimelineFeedProps = {
  items?: FeedItem[];
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
  onItemClick?: (id: string) => void;
};

export const TimelineFeed = ({
  items,
  mode = "guest",
  onDelete,
  onItemClick,
}: TimelineFeedProps) => {
  const [filter, setFilter] = useState<"all" | "following" | "favorites">(
    "all",
  );
  const { following, favorites, isLoaded } = useSocial();

  // Use provided items or default mock feed
  const sourceFeed = items || feed;

  const filteredFeed = sourceFeed.filter((item) => {
    if (mode === "cast") return true; // Show all (own) posts in cast mode
    if (filter === "all") return true;
    if (filter === "following") return following.includes(item.castId);
    if (filter === "favorites") return favorites.includes(item.castId);
    return true;
  });

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
        {(!items && !isLoaded) ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading...</div>
        ) : filteredFeed.length > 0 ? (
          filteredFeed.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              mode={mode}
              onDelete={onDelete}
              onClick={() => onItemClick?.(item.id)}
            />
          ))
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

export const TimelineItem = ({
  item,
  mode = "guest",
  onDelete,
  onClick,
}: {
  item: FeedItem;
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onClick={onClick}
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm relative group ${onClick ? "cursor-pointer hover:border-pink-200 transition-colors" : ""}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <img
          src={item.castImage}
          alt={item.castName}
          className="h-10 w-10 rounded-full border border-slate-100"
        />
        <div>
          <div className="font-bold text-slate-800">{item.castName}</div>
          <div className="text-xs text-slate-400">{item.time}</div>
        </div>
        {mode === "cast" && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
        {item.content}
      </p>
      {item.mediaUrl && (
        <div className="mb-3 overflow-hidden rounded-xl bg-black/5 relative">
          {item.mediaType === 'video' ? (
            <>
              <video
                src={item.mediaUrl}
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
              src={item.mediaUrl}
              alt="Post"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}
      {!item.mediaUrl && item.image && (
        // Fallback for legacy data if any
        (<div className="mb-3 overflow-hidden rounded-xl">
          <img
            src={item.image}
            alt="Post"
            className="h-full w-full object-cover"
          />
        </div>)
      )}
      <div className="flex items-center gap-6 border-t border-slate-50 pt-3 text-slate-400">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-pink-500" : "text-slate-400 hover:text-pink-400"}`}
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
