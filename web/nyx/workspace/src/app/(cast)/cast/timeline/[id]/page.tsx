"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, Heart, MessageCircle, Trash2, Calendar } from "lucide-react";
import { useCastPosts, CastPost, CommentSection } from "@/modules/post";
import { useToast } from "@/components/ui/Toast";
import { formatTimeAgo } from "@/lib/utils/date";

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { posts, loading, fetchPosts, deletePost, removePostLocally, restorePostLocally } = useCastPosts();
  const [post, setPost] = useState<CastPost | null>(null);
  const pendingDelete = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchPosts().catch(() => {});
  }, [fetchPosts]);

  useEffect(() => {
    const found = posts.find((p) => p.id === id);
    if (found) setPost(found);
  }, [posts, id]);

  useEffect(() => {
    return () => {
      if (pendingDelete.current) clearTimeout(pendingDelete.current);
    };
  }, []);

  const handleDelete = () => {
    if (!post) return;
    const postToDelete = { ...post };

    removePostLocally(post.id);
    router.back();

    const timer = setTimeout(async () => {
      pendingDelete.current = null;
      try {
        await deletePost(postToDelete.id);
      } catch (e) {
        console.error("Failed to delete post:", e);
        restorePostLocally(postToDelete);
      }
    }, 5000);

    pendingDelete.current = timer;

    toast({
      title: "Post deleted",
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer);
          pendingDelete.current = null;
          restorePostLocally(postToDelete);
        },
      },
    });
  };

  if (loading && !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-text-secondary">Post not found.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Post Content */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            {post.author?.imageUrl && post.author.imageUrl.trim() !== "" ? (
              <img
                src={post.author.imageUrl}
                alt={post.author.name || ""}
                className="h-10 w-10 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full border border-border bg-border" />
            )}
            <div>
              <div className="font-bold text-text-primary">{post.author?.name || ""}</div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Calendar size={12} />
                {formatTimeAgo(post.createdAt)}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-text-muted hover:text-error"
            onClick={handleDelete}
          >
            <Trash2 size={18} />
          </Button>
        </div>

        <div className="p-4">
          <p className="text-base leading-relaxed text-text-secondary whitespace-pre-wrap mb-4">
            {post.content}
          </p>

          {post.media.length > 0 && (
            <div className="space-y-3">
              {post.media.map((m, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-black/5">
                  {m.mediaType === "video" ? (
                    <video
                      src={m.url}
                      className="w-full h-auto max-h-[600px]"
                      controls
                      playsInline
                      autoPlay={i === 0}
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={`Post media ${i + 1}`}
                      className="w-full h-auto"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-secondary border-t border-border flex items-center gap-6">
          <div className="flex items-center gap-2 text-text-muted opacity-50">
            <Heart size={20} />
            <span className="font-bold">{post.likesCount}</span>
            <span className="text-xs font-normal">Likes</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <MessageCircle size={20} />
            <span className="font-bold">{post.commentsCount}</span>
            <span className="text-xs font-normal">Comments</span>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
        <CommentSection postId={id} commentsCount={post.commentsCount} />
      </div>
    </div>
  );
}
