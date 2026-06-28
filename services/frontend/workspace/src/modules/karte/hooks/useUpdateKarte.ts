"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { KarteEntry } from "../types";

export function useUpdateKarte() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (
    id: string,
    rating: number,
    body: string
  ): Promise<KarteEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: KarteEntry }>(`/api/karte/${id}`, {
        method: "PATCH",
        body: { rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to update karte"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}
