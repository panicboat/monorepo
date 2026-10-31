"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewPage } from "../types";

export function useAuthorReviews(authorProfileId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<ReviewPage>(authorProfileId ? `/api/review/by-author?profile_id=${encodeURIComponent(authorProfileId)}` : null);
  useReviewRevalidation(mutate);

  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    hiddenByLock: !!pages[0]?.hiddenByLock,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
