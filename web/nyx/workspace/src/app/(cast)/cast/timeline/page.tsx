"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TimelineFeed, FeedItem } from "@/modules/discovery/components/guest/TimelineFeed";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { HashtagInput } from "@/components/ui/HashtagInput";
import { Send, Image as ImageIcon, Video, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useCastPosts } from "@/modules/social/hooks/useCastPosts";
import { CastPost } from "@/modules/social/types";
import { useToast } from "@/components/ui/Toast";
import { useCastData } from "@/modules/portfolio/hooks";

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
  return {
    id: post.id,
    castId: post.castId,
    castName: post.author?.name || "",
    castImage: post.author?.imageUrl || "",
    content: post.content,
    time: formatTimeAgo(post.createdAt),
    media: post.media.map((m) => ({
      mediaType: m.mediaType as "image" | "video",
      url: m.url,
    })),
    likes: post.likesCount,
    comments: post.commentsCount,
    visible: post.visible,
    hashtags: post.hashtags,
  };
}

export default function CastTimelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { posts, loading, fetchPosts, savePost, toggleVisibility, deletePost, removePostLocally, restorePostLocally } = useCastPosts();
  const { avatarUrl } = useCastData({ apiPath: "/api/cast/profile" });
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const MAX_MEDIA = 10;

  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<{ file: File; previewUrl: string; type: "image" | "video" }[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts().catch(() => {});
  }, [fetchPosts]);

  useEffect(() => {
    const timers = pendingDeletes.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

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
    if (!content.trim() && mediaFiles.length === 0) return;

    setPosting(true);
    try {
      const media: { mediaType: "image" | "video"; url: string; thumbnailUrl?: string }[] = [];

      if (mediaFiles.length > 0) {
        setUploadProgress({ current: 0, total: mediaFiles.length });
        for (let i = 0; i < mediaFiles.length; i++) {
          const mf = mediaFiles[i];
          setUploadProgress({ current: i + 1, total: mediaFiles.length });
          const key = await uploadFile(mf.file);
          if (key) {
            media.push({ mediaType: mf.type, url: key });
          }
        }
      }

      await savePost({ content: content.trim(), media, hashtags });
      setContent("");
      setHashtags([]);
      mediaFiles.forEach((mf) => URL.revokeObjectURL(mf.previewUrl));
      setMediaFiles([]);
    } catch (e) {
      console.error("Failed to save post:", e);
    } finally {
      setPosting(false);
      setUploadProgress(null);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      await toggleVisibility(id, visible);
      toast({
        title: visible ? "Post is now public" : "Post is now hidden",
        variant: "success",
      });
    } catch (e) {
      console.error("Failed to toggle visibility:", e);
      toast({ title: "Failed to update visibility", variant: "destructive" });
    }
  };

  const handleDelete = useCallback((id: string) => {
    const postToDelete = posts.find((p) => p.id === id);
    if (!postToDelete) return;

    removePostLocally(id);

    const existing = pendingDeletes.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        await deletePost(id);
      } catch (e) {
        console.error("Failed to delete post:", e);
        restorePostLocally(postToDelete);
        toast({ title: "Failed to delete post", variant: "destructive" });
      }
    }, 5000);

    pendingDeletes.current.set(id, timer);

    toast({
      title: "Post deleted",
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer);
          pendingDeletes.current.delete(id);
          restorePostLocally(postToDelete);
        },
      },
    });
  }, [posts, removePostLocally, restorePostLocally, deletePost, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    const remaining = MAX_MEDIA - mediaFiles.length;

    if (selected.length > remaining) {
      toast({
        title: `Maximum ${MAX_MEDIA} files allowed`,
        description: remaining > 0 ? `You can add ${remaining} more file(s).` : "Remove some files first.",
        variant: "destructive",
      });
    }

    const toAdd = selected.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type,
    }));
    setMediaFiles((prev) => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
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
          {avatarUrl ? (
            <img src={avatarUrl} alt="My avatar" className="w-10 h-10 rounded-full border border-slate-100 object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full border border-slate-100 bg-slate-200 shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            <textarea
              className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-pink-100 focus:bg-white transition-all resize-none placeholder:text-slate-300"
              rows={3}
              placeholder="What's happening? (e.g., Schedule update, Daily life...)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <HashtagInput
              value={hashtags}
              onChange={setHashtags}
              placeholder="Add hashtag... (Enter/Space to add)"
              maxTags={10}
            />

            <AnimatePresence>
              {mediaFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {mediaFiles.map((mf, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden bg-black/5 aspect-square">
                        {mf.type === 'video' ? (
                          <video
                            src={mf.previewUrl}
                            className="h-full w-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={mf.previewUrl}
                            alt={`Preview ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-1 right-1 h-6 w-6 bg-white/80 hover:bg-white text-slate-700"
                          onClick={() => removeMediaFile(i)}
                        >
                          <X size={12} />
                        </Button>
                        {mf.type === 'video' && (
                          <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            VIDEO
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {mediaFiles.length}/{MAX_MEDIA} files
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {uploadProgress && (
              <div className="space-y-1">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-pink-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Uploading {uploadProgress.current}/{uploadProgress.total}...
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e, 'image')}
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  className="hidden"
                  accept="video/*"
                  multiple
                  onChange={(e) => handleFileSelect(e, 'video')}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-pink-500 hover:bg-pink-50 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mediaFiles.length >= MAX_MEDIA}
                >
                  <ImageIcon size={18} />
                  <span className="text-xs font-bold">Photo</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-pink-500 hover:bg-pink-50 gap-2"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={mediaFiles.length >= MAX_MEDIA}
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
                disabled={(!content.trim() && mediaFiles.length === 0) || posting}
              >
                <Send size={16} className="mr-2" />
                {posting ? (uploadProgress ? `Uploading...` : "Posting...") : "Post"}
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
