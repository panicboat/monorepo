"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewCounts, MyReviewPage } from "../types";

const NO_COUNTS: ReviewCounts = { total: 0, unrated: 0 };

export function useMyReviews() {
  const role = useAuthStore(selectRole);
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<MyReviewPage>(role === "guest" ? "/api/review/my" : null);
  useReviewRevalidation(mutate);

  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    counts: pages[0]?.counts ?? NO_COUNTS,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
