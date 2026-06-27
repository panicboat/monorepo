"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedPostsResponse, RankPeriodLiteral } from "../types";

export function useRankPosts(period: RankPeriodLiteral) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedPostsResponse | null): string | null => {
    if (!userId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/discovery/ranking?period=${encodeURIComponent(period)}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedPostsResponse>(getKey, fetcher, { revalidateOnFocus: false });

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
