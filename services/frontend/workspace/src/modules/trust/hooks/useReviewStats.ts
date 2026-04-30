"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { ReviewStatsResponse } from "../types";

export function useReviewStats(revieweeId: string | null) {
  const token = getAuthToken();

  const { data, error, isLoading: loading, mutate } = useSWR<ReviewStatsResponse>(
    token && revieweeId ? `/api/shared/trust/reviews/stats?reviewee_id=${revieweeId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    stats: data?.stats || null,
    loading,
    error,
    mutate,
  };
}
