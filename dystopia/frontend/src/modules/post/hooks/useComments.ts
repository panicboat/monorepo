"use client";

import { cursorKey, useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedCommentsResponse } from "@/modules/post/lib/comment-view";

const commentsUrl = (postId: string) => `/api/posts/${encodeURIComponent(postId)}/comments`;

export const commentsKey = (postId: string) => cursorKey(commentsUrl(postId));

export function useComments(postId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedCommentsResponse>(postId ? commentsUrl(postId) : null);

  return {
    comments: pages.flatMap((p) => p.comments || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
