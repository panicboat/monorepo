"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useBlockedList() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    token ? "/api/social/blocks" : null,
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
