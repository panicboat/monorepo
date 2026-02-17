"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { useComments } from "@/modules/post/hooks/useComments";
import { useAuthStore } from "@/stores/authStore";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";

type CommentSectionProps = {
  postId: string;
  commentsCount: number;
};

export function CommentSection({ postId, commentsCount: initialCount }: CommentSectionProps) {
  const {
    comments,
    loading,
    error,
    hasMore,
    fetchComments,
    fetchMoreComments,
    addComment,
    deleteComment,
    addingComment,
    deletingCommentId,
    repliesState,
    toggleReplies,
    fetchMoreReplies,
  } = useComments(postId);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const currentUserId = useAuthStore((state) => state.userId);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // Fetch comments on mount
  useEffect(() => {
    if (isHydrated) {
      fetchComments();
    }
  }, [fetchComments, isHydrated]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchMoreComments();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, fetchMoreComments]);

  const handleAddComment = useCallback(
    async (content: string, media: { mediaType: "image" | "video"; url: string; thumbnailUrl?: string }[]) => {
      await addComment(content, undefined, media);
    },
    [addComment]
  );

  const handleAddReply = useCallback(
    async (parentId: string, content: string, media: { mediaType: "image" | "video"; url: string; thumbnailUrl?: string }[]) => {
      await addComment(content, parentId, media);
      setReplyingTo(null);
    },
    [addComment]
  );

  const handleDelete = useCallback(
    async (commentId: string, parentId?: string) => {
      if (confirm("Are you sure you want to delete this comment?")) {
        await deleteComment(commentId, parentId);
      }
    },
    [deleteComment]
  );

  const handleReply = useCallback((commentId: string) => {
    setReplyingTo(commentId);
  }, []);

  const actualCount = initialCount || comments.length;

  return (
    <section className="border-t border-border pt-4" aria-labelledby="comments-heading">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle aria-hidden="true" className="h-5 w-5 text-text-secondary" />
        <h3 className="font-semibold text-text-primary" id="comments-heading">
          Comments {actualCount > 0 && `(${actualCount})`}
        </h3>
      </div>

      {/* Comment Form */}
      {isAuthenticated() ? (
        <div className="mb-4">
          <CommentForm
            onSubmit={handleAddComment}
            isSubmitting={addingComment}
            placeholder="Add a comment..."
          />
        </div>
      ) : (
        <div className="mb-4 p-3 bg-surface-secondary rounded-lg text-center">
          <p className="text-sm text-text-secondary">
            Please log in to comment
          </p>
        </div>
      )}

      {/* Comments List */}
      {error && (
        <div className="p-3 bg-error-lighter rounded-lg text-center mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {comments.length === 0 && !loading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-text-muted">No comments yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={currentUserId || undefined}
                onDelete={handleDelete}
                onReply={handleReply}
                isDeleting={deletingCommentId === comment.id}
                replies={repliesState[comment.id]?.replies || []}
                repliesExpanded={repliesState[comment.id]?.expanded || false}
                repliesLoading={repliesState[comment.id]?.loading || false}
                hasMoreReplies={repliesState[comment.id]?.hasMore || false}
                onToggleReplies={() => toggleReplies(comment.id)}
                onLoadMoreReplies={() => fetchMoreReplies(comment.id)}
              />

              {/* Reply Form */}
              {replyingTo === comment.id && isAuthenticated() && (
                <div className="ml-8 pl-4 pb-3 border-l-2 border-border">
                  <CommentForm
                    onSubmit={(content, media) => handleAddReply(comment.id, content, media)}
                    isSubmitting={addingComment}
                    placeholder={`Reply to ${comment.author?.name || "this comment"}...`}
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                    isReply
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {loading && (
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-text-muted" />
        )}
      </div>
    </section>
  );
}
