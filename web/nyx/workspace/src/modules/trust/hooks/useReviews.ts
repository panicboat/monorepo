"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Review, CreateReviewRequest, CreateReviewResponse, ListReviewsResponse } from "../types";

export function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReviews = useCallback(async (revieweeId: string, status?: string) => {
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      let url = `/api/shared/trust/reviews?reviewee_id=${revieweeId}`;
      if (status) {
        url += `&status=${status}`;
      }
      const data = await authFetch<ListReviewsResponse>(url);
      setReviews(data.reviews || []);
      return data.reviews || [];
    } catch (e) {
      console.error("Fetch reviews error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createReview = useCallback(async (request: CreateReviewRequest) => {
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<CreateReviewResponse>("/api/me/trust/reviews", {
        method: "POST",
        body: request,
      });
      return data;
    } catch (e) {
      console.error("Create review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateReview = useCallback(async (id: string, content: string | undefined, score: number) => {
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "PATCH",
        body: { content, score },
      });

      if (data.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, content, score } : r))
        );
      }
      return data.success;
    } catch (e) {
      console.error("Update review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "DELETE",
      });

      if (data.success) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Delete review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reviews,
    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
    loading,
  };
}
