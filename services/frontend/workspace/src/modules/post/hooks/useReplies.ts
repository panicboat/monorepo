"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedCommentsResponse } from "@/modules/post/lib/comment-view";

export function useReplies(
  postId: string | null | undefined,
  commentId: string | null | undefined,
  enabled: boolean
) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedCommentsResponse | null): string | null => {
    if (!enabled || !token || !postId || !commentId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/replies`;
    return pageIndex === 0 ? base : `${base}?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedCommentsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const replies = pages.flatMap((p) => p.comments || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    replies,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
