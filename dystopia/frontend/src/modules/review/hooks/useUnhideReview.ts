"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useUnhideReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unhide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch(`/api/review/${entryId}/unhide`, { method: "POST" });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to unhide review"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { unhide, loading, error };
}
