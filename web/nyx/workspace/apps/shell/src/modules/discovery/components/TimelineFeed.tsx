"use client";

import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";

type FeedItem = {
  id: string;
  castName: string;
  castImage: string;
  content: string;
  time: string;
  image?: string;
  likes: number;
  comments: number;
};

// Mock "Tweet-like" activities
const feed: FeedItem[] = [
  {
    id: "1", castName: "Yuna", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content: "Just finished a wonderful ritual! 🕯️ Thank you for the pledge. Tonight I still have 1 slot open at 23:00.",
    time: "10m ago",
    likes: 24, comments: 2
  },
  {
    id: "2", castName: "Mio", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    content: "New cosplay arrived! 👗 Can't wait to show you all.",
    time: "30m ago",
    image: "https://placehold.co/600x400/rose/white?text=Cosplay+Teaser",
    likes: 156, comments: 12
  },
  {
    id: "3", castName: "Rin", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    content: "Rainy days are for deep conversations... ☔ Anyone up for a chat?",
    time: "1h ago",
    likes: 42, comments: 5
  },
  {
    id: "4", castName: "Sarah", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "Good morning! ☀️ Starting my shift at 18:00 today. See you soon!",
    time: "4h ago",
    likes: 89, comments: 8
  },
  {
    id: "5", castName: "Kila", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila",
    content: "Listening to jazz and drinking coffee. Recommendations? ☕",
    time: "5h ago",
    likes: 33, comments: 14
  },
  {
    id: "6", castName: "Elena", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
    content: "Last night was magical. Thanks to everyone who pledged! ✨",
    time: "12h ago",
    likes: 210, comments: 45
  },
  {
    id: "7", castName: "Aoi", castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aoi",
    content: "Just woke up... sleepy... 💤",
    time: "14h ago",
    likes: 110, comments: 20
  }
];

export const TimelineFeed = () => {
  return (
    <div className="space-y-4 py-4 min-h-screen">
      <h2 className="px-4 text-lg font-bold font-serif text-slate-800">Timeline</h2>
      <div className="space-y-4 px-4 pb-20">
        {feed.map((item) => (
          <TimelineItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

import { useState } from "react";

const TimelineItem = ({ item }: { item: FeedItem }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes);

  const handleLike = () => {
    if (liked) {
      setLikesCount(p => p - 1);
    } else {
      setLikesCount(p => p + 1);
    }
    setLiked(!liked);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3">
        <img src={item.castImage} alt={item.castName} className="h-10 w-10 rounded-full border border-slate-100" />
        <div>
          <div className="font-bold text-slate-800">{item.castName}</div>
          <div className="text-xs text-slate-400">{item.time}</div>
        </div>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-slate-600">{item.content}</p>

      {item.image && (
        <div className="mb-3 overflow-hidden rounded-xl">
          <img src={item.image} alt="Post" className="h-full w-full object-cover" />
        </div>
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
