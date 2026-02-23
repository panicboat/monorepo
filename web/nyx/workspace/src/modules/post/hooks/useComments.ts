"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
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

interface AddCommentResponse {
  comment: Comment;
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

  const fetchComments = useCallback(
    async (cursor?: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams({ post_id: postId });
        if (cursor) params.set("cursor", cursor);

        const data = await authFetch<CommentsListResult>(
          `/api/guest/comments?${params}`,
          { requireAuth: false }
        );

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
    [postId]
  );

  const fetchMoreComments = useCallback(async () => {
    if (!state.hasMore || state.loading) return;
    await fetchComments(state.nextCursor);
  }, [fetchComments, state.hasMore, state.loading, state.nextCursor]);

  const addComment = useCallback(
    async (content: string, parentId?: string, media?: CommentMedia[]) => {
      if (!getAuthToken()) {
        throw new Error("Unauthorized");
      }

      setAddingComment(true);

      try {
        const data = await authFetch<AddCommentResponse>("/api/guest/comments", {
          method: "POST",
          body: {
            postId,
            content,
            parentId: parentId || undefined,
            media: media || [],
          },
        });

        if (data.comment) {
          if (parentId) {
            setRepliesState((prev) => ({
              ...prev,
              [parentId]: {
                ...prev[parentId],
                replies: [data.comment, ...(prev[parentId]?.replies || [])],
              },
            }));
            setState((prev) => ({
              ...prev,
              comments: prev.comments.map((c) =>
                c.id === parentId ? { ...c, repliesCount: c.repliesCount + 1 } : c
              ),
            }));
          } else {
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
    [postId]
  );

  const deleteComment = useCallback(
    async (commentId: string, parentId?: string) => {
      if (!getAuthToken()) {
        throw new Error("Unauthorized");
      }

      setDeletingCommentId(commentId);

      try {
        const data = await authFetch<{ success: boolean }>(
          `/api/guest/comments/${commentId}`,
          { method: "DELETE" }
        );

        if (parentId) {
          setRepliesState((prev) => ({
            ...prev,
            [parentId]: {
              ...prev[parentId],
              replies: (prev[parentId]?.replies || []).filter((r) => r.id !== commentId),
            },
          }));
          setState((prev) => ({
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === parentId ? { ...c, repliesCount: Math.max(0, c.repliesCount - 1) } : c
            ),
          }));
        } else {
          setState((prev) => ({
            ...prev,
            comments: prev.comments.filter((c) => c.id !== commentId),
          }));
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
    []
  );

  const fetchReplies = useCallback(async (commentId: string, cursor?: string) => {
    // FALLBACK: Returns empty/default values when replies state is not initialized
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

      const data = await authFetch<RepliesListResult>(
        `/api/guest/comments/${commentId}/replies?${params}`,
        { requireAuth: false }
      );

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
  }, []);

  const toggleReplies = useCallback(
    (commentId: string) => {
      const current = repliesState[commentId];
      if (current?.expanded) {
        setRepliesState((prev) => ({
          ...prev,
          [commentId]: {
            ...prev[commentId],
            expanded: false,
          },
        }));
      } else {
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
