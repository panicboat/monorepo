"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedBookmarksResponse } from "../types";

export function useBookmarkList() {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedBookmarksResponse>("/api/bookmarks");
  return {
    items: pages.flatMap((p) => p.items || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
