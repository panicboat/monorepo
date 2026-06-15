"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowList(accountId?: string) {
  const token = getAuthToken();
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    token ? `/api/social/following${qs}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    profiles: data?.profiles || [],
    nextCursor: data?.nextCursor || "",
    hasMore: data?.hasMore || false,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
