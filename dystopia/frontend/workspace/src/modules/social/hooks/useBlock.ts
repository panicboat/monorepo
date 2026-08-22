"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

interface StatusResponse { blocked: Record<string, boolean> }

export function useBlock(targetAccountId: string | null | undefined) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/social/blocks/status",
          { method: "POST", body: { targetAccountIds: [targetAccountId] } }
        );
        if (cancelled) return;
        setIsBlocked(!!res.blocked?.[targetAccountId]);
      } catch (e) {
        console.error("useBlock fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetAccountId]);

  const block = useCallback(async () => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    setLoading(true);
    try {
      await authFetch("/api/social/blocks", { method: "POST", body: { targetAccountId } });
      setIsBlocked(true);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const unblock = useCallback(async () => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/blocks?target_account_id=${encodeURIComponent(targetAccountId)}`, { method: "DELETE" });
      setIsBlocked(false);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  return { isBlocked, block, unblock, loading };
}
