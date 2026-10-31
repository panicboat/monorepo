"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewsByTargetPage, RatingSummary } from "../types";

const NO_SUMMARY: RatingSummary = { averageRating: null, raterCount: 0, reviewCount: 0 };

export function useCastReviews(targetProfileId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: ReviewsByTargetPage | null): string | null => {
    if (!profileId || !targetProfileId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/review/by-target?profile_id=${encodeURIComponent(targetProfileId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<ReviewsByTargetPage>(getKey, fetcher, { revalidateOnFocus: false });
  useReviewRevalidation(mutate);

  const pages = data || [];
  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    summary: pages[0]?.summary ?? NO_SUMMARY,
    hiddenByLock: !!pages[0]?.hiddenByLock,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
