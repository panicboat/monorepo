"use client";

import { useState, useRef } from "react";
import { TimelineFeed, FeedItem, feed } from "@/modules/discovery/components/guest/TimelineFeed";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Send, Image as ImageIcon, Video, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function CastTimelinePage() {
  const router = useRouter();
  // Use mock data for initial state
  const [posts, setPosts] = useState<FeedItem[]>(
    feed.filter((item) => item.castId === "1") // Assuming logged-in cast is ID 1 (Yuna)
  );

  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePost = () => {
    if (!content.trim() && !mediaUrl) return;

    const newPost: FeedItem = {
      id: crypto.randomUUID(),
      castId: "1",
      castName: "Yuna",
      castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
      content: content,
      time: "Just now",
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaUrl ? mediaType : undefined,
      likes: 0,
      comments: 0,
    };

    setPosts([newPost, ...posts]);
    setContent("");
    setMediaUrl(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this post?")) {
      setPosts(posts.filter((p) => p.id !== id));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaUrl(URL.createObjectURL(file));
      setMediaType(type);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-slate-800">My Timeline</h1>
      </div>

      {/* New Post Form */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          New Post
        </Label>
        <div className="flex gap-4">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna"
            alt="Me"
            className="w-10 h-10 rounded-full border border-slate-100"
          />
          <div className="flex-1 space-y-3">
            <textarea
              className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-pink-100 focus:bg-white transition-all resize-none placeholder:text-slate-400"
              rows={3}
              placeholder="What's happening? (e.g., Schedule update, Daily life...)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <AnimatePresence>
              {mediaUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative rounded-xl overflow-hidden group bg-black/5"
                >
                  {mediaType === 'video' ? (
                    <video
                      src={mediaUrl}
                      className="max-h-64 rounded-xl object-cover w-full"
                      controls
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt="Upload Preview"
                      className="max-h-64 rounded-xl object-cover w-full"
                    />
                  )}

                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-700"
                    onClick={() => setMediaUrl(null)}
                  >
                    <X size={16} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'image')}
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  className="hidden"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, 'video')}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-pink-500 hover:bg-pink-50 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon size={18} />
                  <span className="text-xs font-bold">Photo</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-pink-500 hover:bg-pink-50 gap-2"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video size={18} />
                  <span className="text-xs font-bold">Video</span>
                </Button>
              </div>

              <Button
                variant="brand"
                size="sm"
                className="px-6 rounded-full"
                onClick={handlePost}
                disabled={!content.trim() && !mediaUrl}
              >
                <Send size={16} className="mr-2" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Feed */}
      <div>
        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block px-1">
          Recent Posts
        </Label>
        <TimelineFeed
          items={posts}
          mode="cast"
          onDelete={handleDelete}
          onItemClick={(id) => router.push(`/cast/timeline/${id}`)}
        />
      </div>
    </div>
  );
}
