"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";

interface Response {
  count: number;
}

export function useTotalUnread() {
  const token = getAuthToken();
  const { data, isLoading, mutate } = useSWR<Response>(
    token ? "/api/messaging/unread-count" : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );
  return {
    count: data?.count ?? 0,
    loading: isLoading,
    refresh: () => mutate(),
  };
}
