"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KarteStatus, PaginatedKarteMyResponse } from "../types";

export function useMyKarte(status: "all" | KarteStatus = "all", enabled = true) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: PaginatedKarteMyResponse | null): string | null => {
    if (!profileId || !enabled) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/my?status=${status}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedKarteMyResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    entries,
    counts: pages[0]?.counts ?? { total: 0, open: 0, closed: 0 },
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(undefined, { throwOnError: false, populateCache: false }),
  };
}
