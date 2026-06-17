"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";

interface UnreadCountResponse {
  count: number;
}

export function useFootprintsUnreadCount() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    token ? "/api/footprints/unread-count" : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );
  return {
    count: data?.count ?? 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
