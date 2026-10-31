"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedPostsResponse, RankPeriodLiteral } from "../types";

export function useRankPosts(period: RankPeriodLiteral) {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedPostsResponse>(`/api/discovery/ranking?period=${encodeURIComponent(period)}`);
  return {
    posts: pages.flatMap((p) => p.posts || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
