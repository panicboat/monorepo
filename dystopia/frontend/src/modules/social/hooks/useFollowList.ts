"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowList(profileId?: string) {
  const userId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!userId) return null;
    if (prev && !prev.hasMore) return null;
    const profileQs = profileId ? `profile_id=${encodeURIComponent(profileId)}` : "";
    const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const sep = profileQs && cursorQs ? "&" : "";
    const qs = (profileQs || cursorQs) ? `?${profileQs}${sep}${cursorQs}` : "";
    return `/api/social/following${qs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
