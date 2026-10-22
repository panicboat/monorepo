"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

export const UNREAD_COUNT_KEY = "/api/notifications/unread-count";

interface UnreadCountResponse {
  count: number;
}

export function useUnreadCount() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    profileId ? UNREAD_COUNT_KEY : null,
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
