"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteReview() {
  const [loading, setLoading] = useState(false);

  const remove = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}`, { method: "DELETE" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading };
}
