"use client";

import { cursorKey, useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedCommentsResponse } from "@/modules/post/lib/comment-view";

const repliesUrl = (postId: string, commentId: string) => `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/replies`;

export const repliesKey = (postId: string, commentId: string) => cursorKey(repliesUrl(postId, commentId));

export function useReplies(
  postId: string | null | undefined,
  commentId: string | null | undefined,
  enabled: boolean
) {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedCommentsResponse>(
    enabled && postId && commentId ? repliesUrl(postId, commentId) : null
  );

  return {
    replies: pages.flatMap((p) => p.comments || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
