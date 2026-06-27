"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import type { CreateReviewRequest, CreateReviewResponse } from "../types";

export function useReviews() {
  const [mutating, setMutating] = useState(false);

  const createReview = useCallback(async (request: CreateReviewRequest) => {
    if (!useAuthStore.getState().userId) {
      throw new Error("Authentication required");
    }

    setMutating(true);
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
      setMutating(false);
    }
  }, []);

  const updateReview = useCallback(async (id: string, content: string | undefined, score: number) => {
    // FALLBACK: Returns false when not authenticated
    if (!useAuthStore.getState().userId) return false;

    setMutating(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "PATCH",
        body: { content, score },
      });
      return data.success;
    } catch (e) {
      console.error("Update review error:", e);
      throw e;
    } finally {
      setMutating(false);
    }
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    // FALLBACK: Returns false when not authenticated
    if (!useAuthStore.getState().userId) return false;

    setMutating(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "DELETE",
      });
      return data.success;
    } catch (e) {
      console.error("Delete review error:", e);
      throw e;
    } finally {
      setMutating(false);
    }
  }, []);

  return {
    createReview,
    updateReview,
    deleteReview,
    mutating,
  };
}
