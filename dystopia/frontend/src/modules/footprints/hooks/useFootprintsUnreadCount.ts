"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

interface UnreadCountResponse {
  count: number;
}

export function useFootprintsUnreadCount() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    userId ? "/api/footprints/unread-count" : null,
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
