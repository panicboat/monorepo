"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TimelineFeed, FeedItem } from "@/modules/feed";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { HashtagInput } from "@/components/ui/HashtagInput";
import { Send, Lock, LockOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCastPosts, CastPost } from "@/modules/post";
import { useToast } from "@/components/ui/Toast";
import { useCastData } from "@/modules/portfolio/hooks";
import { useAuthStore } from "@/stores/authStore";
import { formatTimeAgo } from "@/lib/utils/date";
import { uploadFile } from "@/lib/media";
import { MediaPicker, MediaFile, UploadProgress } from "@/components/shared/MediaPicker";

const MAX_MEDIA = 10;

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
    visibility: post.visibility,
    hashtags: post.hashtags,
    liked: post.liked,
  };
}

export default function CastTimelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { posts, loading, hasMore, fetchPosts, loadMore, savePost, toggleVisibility, deletePost, removePostLocally, restorePostLocally } = useCastPosts();
  const { avatarUrl } = useCastData({ apiPath: "/api/cast/profile" });
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [visible, setVisible] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHydrated) {
      fetchPosts().catch(() => {});
    }
  }, [fetchPosts, isHydrated]);

  useEffect(() => {
    const timers = pendingDeletes.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const handlePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) return;

    setPosting(true);
    try {
      const media: { mediaType: "image" | "video"; mediaId: string }[] = [];

      if (mediaFiles.length > 0) {
        setUploadProgress({ current: 0, total: mediaFiles.length });
        for (let i = 0; i < mediaFiles.length; i++) {
          const mf = mediaFiles[i];
          setUploadProgress({ current: i + 1, total: mediaFiles.length });
          const result = await uploadFile(mf.file);
          if (result) {
            media.push({ mediaType: mf.type, mediaId: result.mediaId });
          }
        }
      }

      await savePost({ content: content.trim(), media, hashtags, visibility: visible ? "public" : "private" });
      setContent("");
      setHashtags([]);
      setVisible(true);
      mediaFiles.forEach((mf) => URL.revokeObjectURL(mf.previewUrl));
      setMediaFiles([]);
    } catch (e) {
      console.error("Failed to save post:", e);
    } finally {
      setPosting(false);
      setUploadProgress(null);
    }
  };

  const handleToggleVisibility = async (id: string, visibility: "public" | "private") => {
    try {
      await toggleVisibility(id, visibility);
      toast({
        title: visibility === "public" ? "Post is now public" : "Post is now hidden",
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

  const handleMediaChange = (files: MediaFile[]) => {
    if (files.length > MAX_MEDIA) {
      toast({
        title: `Maximum ${MAX_MEDIA} files allowed`,
        variant: "destructive",
      });
      return;
    }
    setMediaFiles(files);
  };

  const feedItems = posts.map(castPostToFeedItem);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* New Post Form */}
      <div className="bg-surface rounded-2xl p-4 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            New Post
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`gap-1 text-xs ${visible ? "text-text-muted hover:text-text-secondary hover:bg-surface-secondary" : "text-success hover:text-success-hover hover:bg-success-lighter"}`}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <LockOpen size={14} /> : <Lock size={14} />}
            <span>{visible ? "Public" : "Private"}</span>
          </Button>
        </div>
        <div className="flex gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="My avatar" className="w-10 h-10 rounded-full border border-border object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full border border-border bg-border shrink-0" />
          )}
          <div className="flex-1 min-w-0 space-y-3">
            <textarea
              className="w-full bg-surface-secondary border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-role-cast-light focus:bg-surface transition-all resize-none placeholder:text-text-muted"
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

            <MediaPicker
              files={mediaFiles}
              onChange={handleMediaChange}
              maxFiles={MAX_MEDIA}
              disabled={posting}
              progress={uploadProgress}
              variant="default"
              showLabels={true}
            />

            <div className="flex items-center justify-end pt-2">
              <Button
                variant="cast"
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
        <Label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block px-1">
          Recent Posts
        </Label>
        {loading && posts.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm">Loading...</div>
        ) : (
          <>
            <TimelineFeed
              items={feedItems}
              mode="cast"
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
              onItemClick={(id) => router.push(`/cast/timeline/${id}`)}
            />
            {hasMore && (
              <div ref={loadMoreRef} className="pt-4 pb-8 text-center">
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
