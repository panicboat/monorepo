"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useHideReview() {
  const [loading, setLoading] = useState(false);

  const hide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}/hide`, { method: "POST" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { hide, loading };
}
