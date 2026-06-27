"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedThreadsResponse } from "../types";

export function useThreads() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<PaginatedThreadsResponse>(
    userId ? "/api/messaging/threads" : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );
  return {
    threads: data?.threads || [],
    totalUnreadCount: data?.totalUnreadCount || 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
