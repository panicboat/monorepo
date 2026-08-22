"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedProfilesResponse } from "../types";

export function useBlockedList() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    userId ? "/api/social/blocks" : null,
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
