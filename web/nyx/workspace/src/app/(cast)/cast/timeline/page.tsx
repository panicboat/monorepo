"use client";

import { useState, useRef, useEffect } from "react";
import { TimelineFeed, FeedItem } from "@/modules/discovery/components/guest/TimelineFeed";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Send, Image as ImageIcon, Video, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useCastPosts } from "@/modules/social/hooks/useCastPosts";
import { CastPost } from "@/modules/social/types";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function castPostToFeedItem(post: CastPost): FeedItem {
  const firstMedia = post.media[0];
  return {
    id: post.id,
    castId: post.castId,
    castName: post.author?.name || "",
    castImage: post.author?.imageUrl || "",
    content: post.content,
    time: formatTimeAgo(post.createdAt),
    mediaUrl: firstMedia?.url,
    mediaType: firstMedia?.mediaType as "image" | "video" | undefined,
    likes: post.likesCount,
    comments: post.commentsCount,
    visible: post.visible,
  };
}

export default function CastTimelinePage() {
  const router = useRouter();
  const { posts, loading, fetchPosts, savePost, toggleVisibility, deletePost } = useCastPosts();

  const [content, setContent] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts().catch(() => {});
  }, [fetchPosts]);

  const uploadFile = async (file: File): Promise<string | null> => {
    const token = localStorage.getItem("nyx_cast_access_token");
    if (!token) return null;

    const res = await fetch("/api/cast/onboarding/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

    if (!res.ok) return null;
    const { url, key } = await res.json();

    const uploadRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadRes.ok) return null;
    return key;
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile) return;

    setPosting(true);
    try {
      const media: { mediaType: "image" | "video"; url: string; thumbnailUrl?: string }[] = [];

      if (mediaFile) {
        const key = await uploadFile(mediaFile);
        if (key) {
          media.push({ mediaType, url: key });
        }
      }

      await savePost({ content: content.trim(), media });
      setContent("");
      setMediaPreview(null);
      setMediaFile(null);
    } catch (e) {
      console.error("Failed to save post:", e);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      await toggleVisibility(id, visible);
    } catch (e) {
      console.error("Failed to toggle visibility:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this post?")) {
      try {
        await deletePost(id);
      } catch (e) {
        console.error("Failed to delete post:", e);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaPreview(URL.createObjectURL(file));
      setMediaFile(file);
      setMediaType(type);
    }
  };

  const feedItems = posts.map(castPostToFeedItem);

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
          <div className="w-10 h-10 rounded-full border border-slate-100 bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-3">
            <textarea
              className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-pink-100 focus:bg-white transition-all resize-none placeholder:text-slate-300"
              rows={3}
              placeholder="What's happening? (e.g., Schedule update, Daily life...)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <AnimatePresence>
              {mediaPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative rounded-xl overflow-hidden group bg-black/5"
                >
                  {mediaType === 'video' ? (
                    <video
                      src={mediaPreview}
                      className="max-h-64 rounded-xl object-cover w-full"
                      controls
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Upload Preview"
                      className="max-h-64 rounded-xl object-cover w-full"
                    />
                  )}

                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-700"
                    onClick={() => { setMediaPreview(null); setMediaFile(null); }}
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
                disabled={(!content.trim() && !mediaFile) || posting}
              >
                <Send size={16} className="mr-2" />
                {posting ? "Posting..." : "Post"}
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
        {loading && posts.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <TimelineFeed
            items={feedItems}
            mode="cast"
            onDelete={handleDelete}
            onToggleVisibility={handleToggleVisibility}
            onItemClick={(id) => router.push(`/cast/timeline/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
