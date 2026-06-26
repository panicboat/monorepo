"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { ReviewStatsResponse } from "../types";

export function useReviewStats(revieweeId: string | null) {
  const userId = useAuthStore((s) => s.userId);

  const { data, error, isLoading: loading, mutate } = useSWR<ReviewStatsResponse>(
    userId && revieweeId ? `/api/shared/trust/reviews/stats?reviewee_id=${revieweeId}` : null,
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
