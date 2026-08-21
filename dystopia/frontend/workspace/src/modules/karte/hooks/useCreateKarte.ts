"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { KarteEntry } from "../types";

export function useCreateKarte() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (
    targetAccountId: string,
    rating: number,
    body: string
  ): Promise<KarteEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: KarteEntry }>("/api/karte", {
        method: "POST",
        body: { targetAccountId, rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to create karte"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}
