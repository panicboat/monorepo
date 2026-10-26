"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedProfilesResponse } from "../types";

export function useBlockedList() {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!profileId) return null;
    if (prev && !prev.hasMore) return null;
    return pageIndex === 0 ? "/api/social/blocks" : `/api/social/blocks?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];

  return {
    profiles: pages.flatMap((page) => page.profiles || []),
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading,
    loadingMore: isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
