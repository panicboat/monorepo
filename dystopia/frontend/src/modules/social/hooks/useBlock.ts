"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

interface StatusResponse { blocked: Record<string, boolean> }

export function useBlock(targetProfileId: string | null | undefined) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/social/blocks/status",
          { method: "POST", body: { targetProfileIds: [targetProfileId] } }
        );
        if (cancelled) return;
        setIsBlocked(!!res.blocked?.[targetProfileId]);
      } catch (e) {
        console.error("useBlock fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetProfileId]);

  const block = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch("/api/social/blocks", { method: "POST", body: { targetProfileId } });
      setIsBlocked(true);
    } finally {
      setLoading(false);
    }
  }, [targetProfileId]);

  const unblock = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/blocks?target_profile_id=${encodeURIComponent(targetProfileId)}`, { method: "DELETE" });
      setIsBlocked(false);
    } finally {
      setLoading(false);
    }
  }, [targetProfileId]);

  const toggle = useCallback(async () => {
    if (isBlocked) {
      if (!confirm("ブロックを解除しますか?")) return;
      await unblock();
    } else {
      if (!confirm("このアカウントをブロックします。よろしいですか?")) return;
      await block();
    }
  }, [isBlocked, block, unblock]);

  return { isBlocked, block, unblock, toggle, loading };
}
