"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedUsersResponse } from "../types";

export function useSuggestedUsers(limit = 10) {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<PaginatedUsersResponse>(
    userId ? `/api/discovery/suggested-users?limit=${limit}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    profiles: data?.profiles ?? [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
