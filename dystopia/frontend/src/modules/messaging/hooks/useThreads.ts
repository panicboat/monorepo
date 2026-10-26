"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedThreadsResponse } from "../types";

export const threadsKey = (pageIndex: number, prev: PaginatedThreadsResponse | null): string | null => {
  if (prev && !prev.hasMore) return null;
  return pageIndex === 0 ? "/api/messaging/threads" : `/api/messaging/threads?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
};

export function useThreads() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<PaginatedThreadsResponse>(
    (pageIndex, prev) => (profileId ? threadsKey(pageIndex, prev) : null),
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );
  const pages = data || [];
  return {
    threads: pages.flatMap((page) => page.threads || []),
    totalUnreadCount: pages[0]?.totalUnreadCount || 0,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading,
    loadingMore: isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
