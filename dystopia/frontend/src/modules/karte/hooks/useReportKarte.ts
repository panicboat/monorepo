"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useReportKarte() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const report = useCallback(async (id: string, reason: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch<{ ok: boolean }>(`/api/karte/${id}/report`, {
        method: "POST",
        body: { reason },
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to report karte"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { report, loading, error };
}
