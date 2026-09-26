"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useHideReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const hide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch(`/api/review/${entryId}/hide`, { method: "POST" });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to hide review"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { hide, loading, error };
}
