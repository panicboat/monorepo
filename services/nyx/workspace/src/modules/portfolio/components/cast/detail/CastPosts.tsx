"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Heart, MessageCircle, Play, MoreHorizontal, Send } from "lucide-react";

export type MediaType = "image" | "video" | "gif";

export type PostMedia = {
  type: MediaType;
  url: string;
  thumbnail?: string; // For video poster or gif preview
};

export type PostItem = {
  id: string;
  castName: string;
  castAvatar: string;
  content: string;
  time: string;
  media?: PostMedia[];
  likes: number;
  comments: number;
  liked?: boolean;
  commentData?: { user: string; text: string }[];
};

// Mock Posts Data
export const MOCK_POSTS: PostItem[] = [
  {
    id: "101",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content:
      "Thank you for the warm pledge today! 💖 I'll be online from 21:00 tomorrow.",
    time: "2 hours ago",
    likes: 45,
    comments: 3,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/pink/white?text=Thank+You",
      },
    ],
  },
  {
    id: "102",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content:
      "New outfit preview! What do you think? It's a bit bolder than usual...",
    time: "Yesterday",
    likes: 120,
    comments: 15,
    media: [
      {
        type: "video",
        url: "#",
        thumbnail:
          "https://placehold.co/600x400/purple/white?text=Outfit+Video",
      },
      {
        type: "image",
        url: "https://placehold.co/600x400/indigo/white?text=Outfit+Selfie",
      },
    ],
  },
  {
    id: "103",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content: "Just had a lovely lunch. Energy charged! 🍱",
    time: "2 days ago",
    likes: 30,
    comments: 0,
  },
];

// Extra Mock Posts for "View All"
export const EXTRA_POSTS: PostItem[] = [
  {
    id: "201",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content: "Good night! 🌙 See you in my dreams...",
    time: "3 days ago",
    likes: 88,
    comments: 10,
    media: [
      {
        type: "gif",
        url: "https://placehold.co/600x400/orange/white?text=Funny+GIF",
      },
    ],
  },
  {
    id: "202",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content: "Throwback to last summer. Missing the beach! 🏖️",
    time: "1 week ago",
    likes: 200,
    comments: 25,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/blue/white?text=Summer+Vibes",
      },
    ],
  },
  {
    id: "203",
    castName: "Yuna",
    castAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    content: "My favorite cafe. The cheesecake here is divine 🍰",
    time: "1 week ago",
    likes: 55,
    comments: 5,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/yellow/white?text=Cheesecake",
      },
    ],
  },
  {
    id: "301",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "1 week ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/cyan/white?text=Sky",
      },
    ],
  },
  {
    id: "302",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "2 weeks ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/lime/white?text=Park",
      },
      {
        type: "image",
        url: "https://placehold.co/600x400/teal/white?text=Walk",
      },
    ],
  },
  {
    id: "303",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "2 weeks ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "video",
        url: "#",
        thumbnail: "https://placehold.co/600x400/red/white?text=Dance",
      },
    ],
  },
  {
    id: "304",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "3 weeks ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/orange/white?text=Sunset",
      },
    ],
  },
  {
    id: "305",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "3 weeks ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/brown/white?text=Coffee",
      },
    ],
  },
  {
    id: "306",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "1 month ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/gray/white?text=Studio",
      },
    ],
  },
  {
    id: "307",
    castName: "Yuna",
    castAvatar: "img",
    content: "...",
    time: "1 month ago",
    likes: 12,
    comments: 2,
    media: [
      {
        type: "image",
        url: "https://placehold.co/600x400/black/white?text=Night",
      },
    ],
  },
];

// ... (MOCK_POSTS export remains here, will be preserved by tool if strictly targeting component, but since I am replacing huge chunk, I might need to be careful.
// Actually, let's target the COMPONENT first. I will split the edit if it's too large, or just replace PostCard and types.)

// ... (skipping Mocks for brevity in Thought, but will replace carefully)

export const PostCard = ({
  post,
  onMediaClick,
}: {
  post: PostItem;
  onMediaClick?: (media: PostMedia) => void;
}) => {
  const [liked, setLiked] = useState(post.liked || false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(post.commentData || []);
  const [commentCount, setCommentCount] = useState(post.comments);

  const handleLike = () => {
    if (liked) {
      setLikeCount((prev) => prev - 1);
    } else {
      setLikeCount((prev) => prev + 1);
    }
    setLiked(!liked);
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;
    setComments([...comments, { user: "Me", text: commentText }]);
    setCommentCount((prev) => prev + 1);
    setCommentText("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2">
          {/* Avatar for context in timeline if needed, currently just time */}
          <div className="h-6 w-6 rounded-full bg-surface-secondary overflow-hidden">
            <img
              src={post.castAvatar}
              alt={post.castName}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-bold text-text-secondary">{post.castName}</span>
          <span className="text-text-muted">•</span>
          <span>{post.time}</span>
        </div>
        <button className="text-text-muted">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap pl-8">
        {post.content}
      </p>

      <div className="pl-8">
        {post.media && post.media.length > 0 && (
          <div
            className={`mb-3 grid gap-1 overflow-hidden rounded-xl ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {post.media.map((item, idx) => (
              <div
                key={idx}
                className="aspect-[4/3] bg-surface-secondary relative group overflow-hidden cursor-pointer"
                onClick={() => onMediaClick && onMediaClick(item)}
              >
                {item.type === "image" && (
                  <img
                    src={item.url}
                    alt="Post media"
                    className="h-full w-full object-cover"
                  />
                )}
                {item.type === "gif" && (
                  <div className="relative h-full w-full">
                    <img
                      src={item.url}
                      alt="GIF"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase backdrop-blur-sm">
                      GIF
                    </div>
                  </div>
                )}
                {item.type === "video" && (
                  <div className="relative h-full w-full">
                    <img
                      src={item.thumbnail || item.url}
                      alt="Video thumbnail"
                      className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm border border-white/20">
                        <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[8px] font-bold text-white font-mono">
                      0:15
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-6 border-t border-border pt-3 text-text-muted">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs transition-colors hover:text-role-cast ${liked ? "text-role-cast" : ""}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            <span>{likeCount}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 text-xs transition-colors hover:text-info ${showComments ? "text-info" : ""}`}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{commentCount}</span>
          </button>
        </div>

        {/* Comment Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                {/* Existing Comments */}
                <div className="space-y-2">
                  {comments.length > 0 ? (
                    comments.map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="font-bold text-text-secondary">
                          {c.user}
                        </span>
                        <span className="text-text-secondary">{c.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-text-muted italic">
                      No comments yet. Be the first!
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-surface-secondary border border-border rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-role-cast-light transition-colors"
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCommentSubmit()
                    }
                  />
                  <button
                    disabled={!commentText.trim()}
                    onClick={handleCommentSubmit}
                    className="p-1.5 rounded-full bg-role-cast-lighter text-role-cast disabled:opacity-50 disabled:bg-surface-secondary disabled:text-text-muted"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Re-export MOCK_POSTS mixed for detail page
export const CastPosts = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayedPosts = isExpanded
    ? [...MOCK_POSTS, ...EXTRA_POSTS]
    : MOCK_POSTS;

  return (
    <section className="bg-surface-secondary py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <h3 className="font-serif text-lg font-bold text-text-primary">
          Media & Posts
        </h3>
        <span className="text-xs font-bold text-text-muted">
          {MOCK_POSTS.length + EXTRA_POSTS.length} posts
        </span>
      </div>

      <div className="space-y-4 px-4">
        {displayedPosts.slice(0, 3).map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <div className="mt-4 px-4">
        <a // Changed to a simple link that effectively goes to the page, but in React we assume client transition
          // However, if we want to replace the button behavior:
          href={`/timeline/1`} // Mock ID for now
          className="block w-full text-center rounded-xl bg-role-cast py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-role-cast-hover"
        >
          View All Posts
        </a>
      </div>
    </section>
  );
};
