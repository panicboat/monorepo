"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewPage } from "../types";

export function useAuthorReviews(authorProfileId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: ReviewPage | null): string | null => {
    if (!profileId || !authorProfileId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/review/by-author?profile_id=${encodeURIComponent(authorProfileId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<ReviewPage>(getKey, fetcher, { revalidateOnFocus: false });
  useReviewRevalidation(mutate);

  const pages = data || [];
  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    hiddenByLock: !!pages[0]?.hiddenByLock,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
