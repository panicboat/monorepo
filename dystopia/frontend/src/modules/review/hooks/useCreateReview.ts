"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { ReviewEntry } from "../types";

export function useCreateReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (
    targetAccountId: string,
    rating: number,
    body: string
  ): Promise<ReviewEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: ReviewEntry }>("/api/review", {
        method: "POST",
        body: { targetAccountId, rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to create review"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}
