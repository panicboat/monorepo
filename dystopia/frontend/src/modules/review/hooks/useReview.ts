"use client";

import useSWR from "swr";
import { AppError } from "@/lib/errors";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import type { Review } from "../types";

const NOT_FOUND = "Review not found";

export function useReview(reviewId: string | null, initial?: Review) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const key = profileId && reviewId ? `/api/review/${encodeURIComponent(reviewId)}` : null;
  const { data, error, mutate } = useSWR<{ review: Review }>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    fallbackData: initial ? { review: initial } : undefined,
  });
  useReviewRevalidation(mutate);

  return {
    review: data?.review ?? null,
    gone: error instanceof AppError && error.message === NOT_FOUND,
    error,
    refresh: () => mutate(),
    apply: (next: Review) => mutate({ review: next }, { revalidate: false }),
  };
}
