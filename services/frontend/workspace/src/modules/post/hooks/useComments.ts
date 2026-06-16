"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedCommentsResponse } from "@/modules/post/lib/comment-view";

export function useComments(postId: string | null | undefined) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedCommentsResponse | null): string | null => {
    if (!token || !postId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/posts/${encodeURIComponent(postId)}/comments${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedCommentsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const comments = pages.flatMap((p) => p.comments || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    comments,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
