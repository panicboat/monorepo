"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useKarteRevalidation } from "../lib/revalidate";
import { uniqueKartes } from "../lib/uniqueKartes";
import type { KartesByTargetPage, ReliabilitySummary } from "../types";

const NO_RELIABILITY: ReliabilitySummary = { averageRating: null, raterCount: 0, karteCount: 0 };

export function useGuestKarte(targetProfileId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<KartesByTargetPage>(targetProfileId ? `/api/karte/by-target?profile_id=${encodeURIComponent(targetProfileId)}` : null);
  useKarteRevalidation(mutate);

  return {
    kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),
    reliability: pages[0]?.reliability ?? NO_RELIABILITY,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
