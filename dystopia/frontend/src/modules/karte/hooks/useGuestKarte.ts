"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KartesByTargetPage, ReliabilitySummary } from "../types";

const NO_RELIABILITY: ReliabilitySummary = { averageRating: null, raterCount: 0, karteCount: 0 };

export function useGuestKarte(targetProfileId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: KartesByTargetPage | null): string | null => {
    if (!profileId || !targetProfileId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/karte/by-target?profile_id=${encodeURIComponent(targetProfileId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<KartesByTargetPage>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  return {
    kartes: pages.flatMap((p) => p.kartes || []),
    reliability: pages[0]?.reliability ?? NO_RELIABILITY,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
