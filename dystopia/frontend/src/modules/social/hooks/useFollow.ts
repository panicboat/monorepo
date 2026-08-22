"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

interface FollowResponse { status: FollowStatus }
interface StatusResponse { statuses: Record<string, FollowStatus> }

export function useFollow(targetAccountId: string | null | undefined) {
  const [status, setStatus] = useState<FollowStatus>(FollowStatus.NONE);
  const [loading, setLoading] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/social/follow/status",
          { method: "POST", body: { targetAccountIds: [targetAccountId] } }
        );
        if (cancelled) return;
        setStatus(res.statuses?.[targetAccountId] ?? FollowStatus.NONE);
      } catch (e) {
        console.error("useFollow fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetAccountId]);

  const follow = useCallback(async () => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    setLoading(true);
    try {
      const res = await authFetch<FollowResponse>(
        "/api/social/follow",
        { method: "POST", body: { targetAccountId } }
      );
      setStatus(res.status ?? FollowStatus.NONE);
      return res.status;
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const unfollow = useCallback(async () => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_account_id=${encodeURIComponent(targetAccountId)}`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const cancelRequest = useCallback(async () => {
    if (!targetAccountId || !useAuthStore.getState().userId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_account_id=${encodeURIComponent(targetAccountId)}&cancel=1`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  return {
    status,
    isFollowing: status === FollowStatus.APPROVED,
    isPending: status === FollowStatus.PENDING,
    follow,
    unfollow,
    cancelRequest,
    loading,
  };
}
