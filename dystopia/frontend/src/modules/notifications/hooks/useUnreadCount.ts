"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

interface UnreadCountResponse {
  count: number;
}

export function useUnreadCount() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    profileId ? "/api/notifications/unread-count" : null,
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
