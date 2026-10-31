"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowerList(profileId?: string) {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedProfilesResponse>(`/api/social/followers${profileId ? `?profile_id=${encodeURIComponent(profileId)}` : ""}`);
  return {
    profiles: pages.flatMap((p) => p.profiles || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
