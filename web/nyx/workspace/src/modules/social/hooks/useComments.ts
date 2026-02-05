"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import type { Comment, CommentMedia, CommentsListResult, RepliesListResult } from "../types";

interface CommentsState {
  comments: Comment[];
  nextCursor: string;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

interface RepliesState {
  [commentId: string]: {
    replies: Comment[];
    nextCursor: string;
    hasMore: boolean;
    loading: boolean;
    expanded: boolean;
  };
}

export function useComments(postId: string) {
  const [state, setState] = useState<CommentsState>({
    comments: [],
    nextCursor: "",
    hasMore: false,
    loading: false,
    error: null,
  });

  const [repliesState, setRepliesState] = useState<RepliesState>({});
  const [addingComment, setAddingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const accessToken = useAuthStore((state) => state.accessToken);

  const fetchComments = useCallback(
    async (cursor?: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams({ post_id: postId });
        if (cursor) params.set("cursor", cursor);

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(`/api/guest/comments?${params}`, { headers });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to fetch comments");
        }

        const data: CommentsListResult = await res.json();

        setState((prev) => ({
          ...prev,
          comments: cursor ? [...prev.comments, ...data.comments] : data.comments,
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
          loading: false,
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [postId, accessToken]
  );

  const fetchMoreComments = useCallback(async () => {
    if (!state.hasMore || state.loading) return;
    await fetchComments(state.nextCursor);
  }, [fetchComments, state.hasMore, state.loading, state.nextCursor]);

  const addComment = useCallback(
    async (content: string, parentId?: string, media?: CommentMedia[]) => {
      const token = accessToken;
      if (!token) {
        throw new Error("Unauthorized");
      }

      setAddingComment(true);

      try {
        const res = await fetch("/api/guest/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            postId,
            content,
            parentId: parentId || undefined,
            media: media || [],
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to add comment");
        }

        const data = await res.json();

        if (data.comment) {
          if (parentId) {
            // It's a reply - add to replies state
            setRepliesState((prev) => ({
              ...prev,
              [parentId]: {
                ...prev[parentId],
                replies: [data.comment, ...(prev[parentId]?.replies || [])],
              },
            }));
            // Update parent's replies_count
            setState((prev) => ({
              ...prev,
              comments: prev.comments.map((c) =>
                c.id === parentId ? { ...c, repliesCount: c.repliesCount + 1 } : c
              ),
            }));
          } else {
            // It's a top-level comment - add to comments state
            setState((prev) => ({
              ...prev,
              comments: [data.comment, ...prev.comments],
            }));
          }
        }

        return data;
      } finally {
        setAddingComment(false);
      }
    },
    [postId, accessToken]
  );

  const deleteComment = useCallback(
    async (commentId: string, parentId?: string) => {
      const token = accessToken;
      if (!token) {
        throw new Error("Unauthorized");
      }

      setDeletingCommentId(commentId);

      try {
        const res = await fetch(`/api/guest/comments/${commentId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to delete comment");
        }

        const data = await res.json();

        if (parentId) {
          // It's a reply - remove from replies state
          setRepliesState((prev) => ({
            ...prev,
            [parentId]: {
              ...prev[parentId],
              replies: (prev[parentId]?.replies || []).filter((r) => r.id !== commentId),
            },
          }));
          // Update parent's replies_count
          setState((prev) => ({
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === parentId ? { ...c, repliesCount: Math.max(0, c.repliesCount - 1) } : c
            ),
          }));
        } else {
          // It's a top-level comment - remove from comments state
          setState((prev) => ({
            ...prev,
            comments: prev.comments.filter((c) => c.id !== commentId),
          }));
          // Also clear any replies state for this comment
          setRepliesState((prev) => {
            const newState = { ...prev };
            delete newState[commentId];
            return newState;
          });
        }

        return data;
      } finally {
        setDeletingCommentId(null);
      }
    },
    [accessToken]
  );

  const fetchReplies = useCallback(
    async (commentId: string, cursor?: string) => {
      setRepliesState((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          replies: prev[commentId]?.replies || [],
          nextCursor: prev[commentId]?.nextCursor || "",
          hasMore: prev[commentId]?.hasMore || false,
          loading: true,
          expanded: true,
        },
      }));

      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(`/api/guest/comments/${commentId}/replies?${params}`, { headers });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to fetch replies");
        }

        const data: RepliesListResult = await res.json();

        setRepliesState((prev) => ({
          ...prev,
          [commentId]: {
            replies: cursor
              ? [...(prev[commentId]?.replies || []), ...data.replies]
              : data.replies,
            nextCursor: data.nextCursor,
            hasMore: data.hasMore,
            loading: false,
            expanded: true,
          },
        }));
      } catch (e) {
        console.error("Fetch replies error:", e);
        setRepliesState((prev) => ({
          ...prev,
          [commentId]: {
            ...prev[commentId],
            loading: false,
          },
        }));
      }
    },
    [accessToken]
  );

  const toggleReplies = useCallback(
    (commentId: string) => {
      const current = repliesState[commentId];
      if (current?.expanded) {
        // Collapse
        setRepliesState((prev) => ({
          ...prev,
          [commentId]: {
            ...prev[commentId],
            expanded: false,
          },
        }));
      } else {
        // Expand and fetch if needed
        if (!current?.replies?.length) {
          fetchReplies(commentId);
        } else {
          setRepliesState((prev) => ({
            ...prev,
            [commentId]: {
              ...prev[commentId],
              expanded: true,
            },
          }));
        }
      }
    },
    [repliesState, fetchReplies]
  );

  const fetchMoreReplies = useCallback(
    (commentId: string) => {
      const current = repliesState[commentId];
      if (!current?.hasMore || current?.loading) return;
      fetchReplies(commentId, current.nextCursor);
    },
    [repliesState, fetchReplies]
  );

  return {
    comments: state.comments,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    fetchComments,
    fetchMoreComments,
    addComment,
    deleteComment,
    addingComment,
    deletingCommentId,
    repliesState,
    toggleReplies,
    fetchMoreReplies,
  };
}
