"use client";

import { cursorKey, useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedThreadsResponse } from "../types";

const THREADS_URL = "/api/messaging/threads";

export const threadsKey = cursorKey(THREADS_URL);

export function useThreads() {
  const { pages, hasMore, isLoading, isValidating, error, loadMore, refresh } = useCursorPages<PaginatedThreadsResponse>(THREADS_URL, { refreshInterval: 30000 });

  return {
    threads: pages.flatMap((page) => page.threads || []),
    totalUnreadCount: pages[0]?.totalUnreadCount || 0,
    hasMore,
    loading: isLoading,
    loadingMore: isValidating,
    error,
    loadMore,
    refresh,
  };
}
