"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedAuthorCommentsResponse } from "@/modules/post/lib/author-tab-view";
import type { PostView } from "@/modules/post/lib/post-view";

export function useAuthorComments(accountId: string | null | undefined) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedAuthorCommentsResponse | null): string | null => {
    if (!token || !accountId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/posts/comments-by-author?author_id=${encodeURIComponent(accountId)}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedAuthorCommentsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const comments = pages.flatMap((p) => p.comments || []);
  // Merge postsById maps across all pages
  const postsById: Record<string, PostView> = {};
  for (const p of pages) {
    Object.assign(postsById, p.postsById || {});
  }
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    comments,
    postsById,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
