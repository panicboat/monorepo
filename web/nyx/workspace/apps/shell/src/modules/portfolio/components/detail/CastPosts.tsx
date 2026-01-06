"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Heart, MessageCircle, Image as ImageIcon } from "lucide-react";

type PostItem = {
  id: string;
  content: string;
  time: string;
  images?: string[];
  likes: number;
  comments: number;
};

// Mock Posts Data
const MOCK_POSTS: PostItem[] = [
  {
    id: "101",
    content: "Thank you for the warm pledge today! 💖 I'll be online from 21:00 tomorrow.",
    time: "2 hours ago",
    likes: 45, comments: 3,
    images: ["https://placehold.co/600x400/pink/white?text=Thank+You"]
  },
  {
    id: "102",
    content: "New outfit preview! What do you think? It's a bit bolder than usual...",
    time: "Yesterday",
    likes: 120, comments: 15,
    images: [
      "https://placehold.co/600x400/purple/white?text=Outfit+1",
      "https://placehold.co/600x400/indigo/white?text=Outfit+2"
    ]
  },
  {
    id: "103",
    content: "Just had a lovely lunch. Energy charged! 🍱",
    time: "2 days ago",
    likes: 30, comments: 0
  }
];

// Extra Mock Posts for "View All"
const EXTRA_MOCK_POSTS: PostItem[] = [
  {
    id: "201",
    content: "Good night! 🌙 See you in my dreams...",
    time: "3 days ago",
    likes: 88, comments: 10
  },
  {
    id: "202",
    content: "Throwback to last summer. Missing the beach! 🏖️",
    time: "1 week ago",
    likes: 200, comments: 25,
    images: ["https://placehold.co/600x400/blue/white?text=Summer+Vibes"]
  },
  {
    id: "203",
    content: "My favorite cafe. The cheesecake here is divine 🍰",
    time: "1 week ago",
    likes: 55, comments: 5,
    images: ["https://placehold.co/600x400/yellow/white?text=Cheesecake"]
  }
];

export const CastPosts = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayedPosts = isExpanded ? [...MOCK_POSTS, ...EXTRA_MOCK_POSTS] : MOCK_POSTS;

  return (
    <section className="bg-slate-50 py-6">
      <h3 className="mb-4 px-4 font-serif text-lg font-bold text-slate-800">Media & Posts</h3>
      <div className="space-y-4 px-4">
        {displayedPosts.map((post) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{post.time}</span>
            </div>

            <p className="mb-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{post.content}</p>

            {post.images && post.images.length > 0 && (
              <div className={`mb-3 grid gap-1 overflow-hidden rounded-xl ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {post.images.map((img, idx) => (
                  <div key={idx} className="aspect-[4/3] bg-slate-100 relative">
                    <img src={img} alt="Post media" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-6 border-t border-slate-50 pt-3 text-slate-400">
              <div className="flex items-center gap-1.5 text-xs">
                <Heart className="h-4 w-4" />
                <span>{post.likes}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <MessageCircle className="h-4 w-4" />
                <span>{post.comments}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {/* View More Button */}
      {!isExpanded && (
        <div className="mt-4 px-4">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            View All Posts
          </button>
        </div>
      )}
    </section>
  );
};
