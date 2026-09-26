"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { ReviewEntry } from "../types";

export function useUpdateReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (
    entryId: string,
    rating: number,
    body: string
  ): Promise<ReviewEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: ReviewEntry }>(`/api/review/${entryId}`, {
        method: "PATCH",
        body: { rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to update review"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}
