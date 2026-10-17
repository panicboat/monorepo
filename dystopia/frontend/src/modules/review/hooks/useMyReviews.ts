"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewCounts, MyReviewPage } from "../types";

const NO_COUNTS: ReviewCounts = { total: 0, open: 0, closed: 0 };

export function useMyReviews() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const role = useAuthStore(selectRole);

  const getKey = (pageIndex: number, prev: MyReviewPage | null): string | null => {
    if (!profileId || role !== "guest") return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/review/my${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<MyReviewPage>(getKey, fetcher, { revalidateOnFocus: false });
  useReviewRevalidation(mutate);

  const pages = data || [];
  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    counts: pages[0]?.counts ?? NO_COUNTS,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
