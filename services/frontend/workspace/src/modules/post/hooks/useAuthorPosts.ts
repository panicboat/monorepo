"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedAuthorPostsResponse } from "@/modules/post/lib/author-tab-view";

export function useAuthorPosts(accountId: string | null | undefined, mediaOnly: boolean) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedAuthorPostsResponse | null): string | null => {
    if (!token || !accountId) return null;
    if (prev && !prev.hasMore) return null;
    const params = new URLSearchParams();
    params.set("author_id", accountId);
    if (mediaOnly) params.set("media_only", "1");
    if (pageIndex > 0 && prev?.nextCursor) params.set("cursor", prev.nextCursor);
    return `/api/posts?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedAuthorPostsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const posts = pages.flatMap((p) => p.posts || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    posts,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
