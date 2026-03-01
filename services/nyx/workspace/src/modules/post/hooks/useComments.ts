"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import { usePaginatedFetch, PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import type { Comment, CommentMedia, CommentsListResult, RepliesListResult } from "../types";

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
  const buildParams = useCallback(
    (params: URLSearchParams) => {
      params.set("post_id", postId);
    },
    [postId]
  );

  const mapResponse = useCallback(
    (data: CommentsListResult): PaginatedResult<Comment> => ({
      items: data.comments,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor || null,
    }),
    []
  );

  const getItemId = useCallback((comment: Comment) => comment.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<CommentsListResult> => {
      return authFetch<CommentsListResult>(url, { requireAuth: false });
    },
    []
  );

  const {
    items: comments,
    setItems: setComments,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchInitial,
    fetchMore,
  } = usePaginatedFetch<Comment, CommentsListResult>({
    apiUrl: "/api/guest/comments",
    mapResponse,
    getItemId,
    buildParams,
    fetchFn,
  });

  const [repliesState, setRepliesState] = useState<RepliesState>({});
  const [addingComment, setAddingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

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
            setComments((prev) =>
              prev.map((c) =>
                c.id === parentId ? { ...c, repliesCount: c.repliesCount + 1 } : c
              )
            );
          } else {
            setComments((prev) => [data.comment, ...prev]);
          }
        }

        return data;
      } finally {
        setAddingComment(false);
      }
    },
    [postId, setComments]
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
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId ? { ...c, repliesCount: Math.max(0, c.repliesCount - 1) } : c
            )
          );
        } else {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
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
    [setComments]
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

      setRepliesState((prev) => {
        const existingReplies = prev[commentId]?.replies || [];
        const existingIds = new Set(existingReplies.map((r) => r.id));
        const newReplies = data.replies.filter((r) => !existingIds.has(r.id));
        return {
          ...prev,
          [commentId]: {
            replies: cursor ? [...existingReplies, ...newReplies] : data.replies,
            nextCursor: data.nextCursor,
            hasMore: data.hasMore,
            loading: false,
            expanded: true,
          },
        };
      });
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
    comments,
    loading,
    loadingMore,
    error: error?.message || null,
    hasMore,
    fetchInitial,
    fetchMore,
    addComment,
    deleteComment,
    addingComment,
    deletingCommentId,
    repliesState,
    toggleReplies,
    fetchMoreReplies,
  };
}
