"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedUsersResponse } from "../types";

export function useSuggestedUsers(limit = 10) {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedUsersResponse>(
    token ? `/api/discovery/suggested-users?limit=${limit}` : null,
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
