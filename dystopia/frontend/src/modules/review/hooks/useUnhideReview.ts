"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useUnhideReview() {
  const [loading, setLoading] = useState(false);

  const unhide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}/unhide`, { method: "POST" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { unhide, loading };
}
