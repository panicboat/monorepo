"use client";

import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { BlockStatusMap } from "../types";

interface Response { blocked: BlockStatusMap }

export function useBlockStatusBatch(targetAccountIds: string[]) {
  const [blocked, setBlocked] = useState<BlockStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = targetAccountIds.join(",");

  useEffect(() => {
    if (!getAuthToken() || targetAccountIds.length === 0) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await authFetch<Response>(
          "/api/social/blocks/status",
          { method: "POST", body: { targetAccountIds } }
        );
        if (cancelled) return;
        setBlocked(res.blocked || {});
      } catch (e) {
        console.error("useBlockStatusBatch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isBlocked = (id: string): boolean => !!blocked[id];

  return { blocked, isBlocked, loading };
}
