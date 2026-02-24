"use client";

import { useCallback, useState, useRef } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Review, ListReviewsResponse } from "../types";

const PAGE_SIZE = 10;

interface UseInfiniteReviewsOptions {
  revieweeId?: string;
  reviewerId?: string;
  status?: string;
}

export function useInfiniteReviews(options: UseInfiniteReviewsOptions) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const buildUrl = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams();
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
    if (cursor) {
      params.set("cursor", cursor);
    }
    return `/api/shared/trust/reviews?${params.toString()}`;
  }, [options.revieweeId, options.reviewerId, options.status]);

  const fetchInitial = useCallback(async () => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }

    // Prevent duplicate initial fetches
    if (initialized || loading) {
      return;
    }

    setLoading(true);
    try {
      const url = buildUrl();
      const data = await authFetch<ListReviewsResponse>(url);
      setReviews(data.reviews);
      setHasMore(data.hasMore || false);
      cursorRef.current = data.nextCursor || null;
      setInitialized(true);
      return data;
    } catch (e) {
      console.error("Fetch reviews error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [buildUrl, initialized, loading]);

  const fetchMore = useCallback(async () => {
    // Wait for initial fetch to complete
    if (!initialized || !getAuthToken() || !hasMore || loadingMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const url = buildUrl(cursorRef.current);
      const data = await authFetch<ListReviewsResponse>(url);
      // Prevent duplicate entries during pagination
      setReviews((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newReviews = data.reviews.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newReviews];
      });
      setHasMore(data.hasMore || false);
      cursorRef.current = data.nextCursor || null;
      return data;
    } catch (e) {
      console.error("Fetch more reviews error:", e);
      throw e;
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, initialized, hasMore, loadingMore]);

  const reset = useCallback(() => {
    setReviews([]);
    setHasMore(true);
    cursorRef.current = null;
    setInitialized(false);
  }, []);

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
