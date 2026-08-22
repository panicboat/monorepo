"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

interface Response {
  count: number;
}

export function useTotalUnread() {
  const userId = useAuthStore((s) => s.userId);
  const { data, isLoading, mutate } = useSWR<Response>(
    userId ? "/api/messaging/unread-count" : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );
  return {
    count: data?.count ?? 0,
    loading: isLoading,
    refresh: () => mutate(),
  };
}
