"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { authFetch } from "@/lib/auth";
import type { PendingReviewsResponse } from "../types";

export function usePendingReviews() {
  const token = getAuthToken();

  const { data, error, isLoading: loading, mutate } = useSWR<PendingReviewsResponse>(
    token ? "/api/cast/trust/reviews/pending" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const approveReview = useCallback(
    async (id: string) => {
      if (!getAuthToken()) return false;

      try {
        const response = await authFetch<{ success: boolean }>(
          `/api/cast/trust/reviews/${id}/approve`,
          { method: "POST" }
        );

        if (response.success) {
          mutate();
        }
        return response.success;
      } catch (e) {
        console.error("Approve review error:", e);
        throw e;
      }
    },
    [mutate]
  );

  const rejectReview = useCallback(
    async (id: string) => {
      if (!getAuthToken()) return false;

      try {
        const response = await authFetch<{ success: boolean }>(
          `/api/cast/trust/reviews/${id}/reject`,
          { method: "POST" }
        );

        if (response.success) {
          mutate();
        }
        return response.success;
      } catch (e) {
        console.error("Reject review error:", e);
        throw e;
      }
    },
    [mutate]
  );

  return {
    pendingReviews: data?.reviews || [],
    loading,
    error,
    mutate,
    approveReview,
    rejectReview,
  };
}
