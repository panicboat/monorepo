"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedCommentsResponse } from "@/modules/post/lib/comment-view";

export const commentsKey =
  (postId: string) =>
  (pageIndex: number, prev: PaginatedCommentsResponse | null): string | null => {
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/posts/${encodeURIComponent(postId)}/comments${cursorQs}`;
  };

export function useComments(postId: string | null | undefined) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: PaginatedCommentsResponse | null): string | null => {
    if (!activeProfileId || !postId) return null;
    return commentsKey(postId)(pageIndex, prev);
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
