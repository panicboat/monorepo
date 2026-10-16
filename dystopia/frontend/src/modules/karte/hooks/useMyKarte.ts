"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectRole } from "@/stores/authStore";
import type { KartePage } from "../types";

export function useMyKarte() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const role = useAuthStore(selectRole);

  const getKey = (pageIndex: number, prev: KartePage | null): string | null => {
    if (!profileId || role !== "cast") return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/my${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<KartePage>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  return {
    kartes: pages.flatMap((p) => p.kartes || []),
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
