"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewsByTargetPage, RatingSummary } from "../types";

const NO_SUMMARY: RatingSummary = { averageRating: null, raterCount: 0, reviewCount: 0 };

export function useCastReviews(targetProfileId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<ReviewsByTargetPage>(targetProfileId ? `/api/review/by-target?profile_id=${encodeURIComponent(targetProfileId)}` : null);
  useReviewRevalidation(mutate);

  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    summary: pages[0]?.summary ?? NO_SUMMARY,
    hiddenByLock: !!pages[0]?.hiddenByLock,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
