"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch(`/api/review/${entryId}`, { method: "DELETE" });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to delete review"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}
