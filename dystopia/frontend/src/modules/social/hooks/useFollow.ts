"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { createRequestBatcher } from "@/lib/request-batcher";
import { useAuthStore } from "@/stores/authStore";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

interface FollowResponse { status: FollowStatus }
interface StatusResponse { statuses: Record<string, FollowStatus>; approvalRequired?: Record<string, boolean> }

const fetchStatus = createRequestBatcher((targetProfileIds) =>
  authFetch<StatusResponse>("/api/social/follow/status", { method: "POST", body: { targetProfileIds } })
);

export function useFollow(targetProfileId: string | null | undefined) {
  const [status, setStatus] = useState<FollowStatus>(FollowStatus.NONE);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchStatus(targetProfileId);
        if (cancelled) return;
        setStatus(res.statuses?.[targetProfileId] ?? FollowStatus.NONE);
        setApprovalRequired(res.approvalRequired?.[targetProfileId] ?? false);
      } catch (e) {
        console.error("useFollow fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetProfileId]);

  const follow = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      const res = await authFetch<FollowResponse>(
        "/api/social/follow",
        { method: "POST", body: { targetProfileId } }
      );
      setStatus(res.status ?? FollowStatus.NONE);
      return res.status;
    } finally {
      setLoading(false);
    }
  }, [targetProfileId]);

  const unfollow = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_profile_id=${encodeURIComponent(targetProfileId)}`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetProfileId]);

  const cancelRequest = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_profile_id=${encodeURIComponent(targetProfileId)}&cancel=1`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetProfileId]);

  return {
    status,
    isFollowing: status === FollowStatus.APPROVED,
    isPending: status === FollowStatus.PENDING,
    approvalRequired,
    follow,
    unfollow,
    cancelRequest,
    loading,
  };
}
