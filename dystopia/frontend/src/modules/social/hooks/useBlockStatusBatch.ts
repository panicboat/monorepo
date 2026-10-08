"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import type { BlockStatusMap } from "../types";

interface Response { blocked: BlockStatusMap }

export function useBlockStatusBatch(targetProfileIds: string[]) {
  const [blocked, setBlocked] = useState<BlockStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = targetProfileIds.join(",");

  useEffect(() => {
    if (!useAuthStore.getState().activeProfileId || targetProfileIds.length === 0) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await authFetch<Response>(
          "/api/social/blocks/status",
          { method: "POST", body: { targetProfileIds } }
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
