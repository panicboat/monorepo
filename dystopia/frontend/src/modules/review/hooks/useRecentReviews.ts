"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewPage } from "../types";

export function useRecentReviews(enabled: boolean) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<ReviewPage>(enabled ? "/api/review/recent" : null);
  useReviewRevalidation(mutate);

  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
