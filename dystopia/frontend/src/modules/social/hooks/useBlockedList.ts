"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedProfilesResponse } from "../types";

export function useBlockedList() {
  const { pages, hasMore, isLoading, isValidating, error, loadMore, refresh } = useCursorPages<PaginatedProfilesResponse>("/api/social/blocks");

  return {
    profiles: pages.flatMap((page) => page.profiles || []),
    hasMore,
    loading: isLoading,
    loadingMore: isValidating,
    error,
    loadMore,
    refresh,
  };
}
