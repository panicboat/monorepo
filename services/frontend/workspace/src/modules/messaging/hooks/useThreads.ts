"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedThreadsResponse } from "../types";

export function useThreads() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedThreadsResponse>(
    token ? "/api/messaging/threads" : null,
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
