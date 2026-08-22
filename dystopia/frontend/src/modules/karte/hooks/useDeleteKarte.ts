"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteKarte() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch<{ ok: boolean }>(`/api/karte/${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to delete karte"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}
