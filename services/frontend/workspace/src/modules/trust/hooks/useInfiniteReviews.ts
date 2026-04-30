"use client";

import { useCallback } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import { usePaginatedFetch, PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import type { Review, ListReviewsResponse } from "../types";

const PAGE_SIZE = 10;

interface UseInfiniteReviewsOptions {
  revieweeId?: string;
  reviewerId?: string;
  status?: string;
}

export function useInfiniteReviews(options: UseInfiniteReviewsOptions) {
  const buildParams = useCallback(
    (params: URLSearchParams) => {
      if (options.revieweeId) {
        params.set("reviewee_id", options.revieweeId);
      }
      if (options.reviewerId) {
        params.set("reviewer_id", options.reviewerId);
      }
      if (options.status) {
        params.set("status", options.status);
      }
      params.set("limit", String(PAGE_SIZE));
    },
    [options.revieweeId, options.reviewerId, options.status]
  );

  const mapResponse = useCallback((data: ListReviewsResponse): PaginatedResult<Review> => ({
    items: data.reviews,
    hasMore: data.hasMore || false,
    nextCursor: data.nextCursor || null,
  }), []);

  const getItemId = useCallback((review: Review) => review.id, []);

  const fetchFn = useCallback(async (url: string): Promise<ListReviewsResponse> => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }
    return authFetch<ListReviewsResponse>(url);
  }, []);

  const {
    items: reviews,
    loading,
    loadingMore,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = usePaginatedFetch<Review, ListReviewsResponse>({
    apiUrl: "/api/shared/trust/reviews",
    mapResponse,
    getItemId,
    authenticated: true,
    buildParams,
    fetchFn,
  });

  return {
    reviews,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
    initialized,
  };
}
