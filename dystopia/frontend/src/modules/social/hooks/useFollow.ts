"use client";

import { useCallback, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { createRequestBatcher } from "@/lib/request-batcher";
import { revalidateReview } from "@/modules/review/lib/revalidate";
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
  const { mutate } = useSWRConfig();

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

  // Reviews go through their own registry because a matcher mutate skips useSWRInfinite keys.
  const refreshLockedContent = useCallback(() => {
    void revalidateReview();
    void mutate((key) => typeof key === "string" && key.startsWith("/api/schedule/list"), undefined, { revalidate: true });
  }, [mutate]);

  const follow = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      const res = await authFetch<FollowResponse>(
        "/api/social/follow",
        { method: "POST", body: { targetProfileId } }
      );
      setStatus(res.status ?? FollowStatus.NONE);
      refreshLockedContent();
      return res.status;
    } finally {
      setLoading(false);
    }
  }, [targetProfileId, refreshLockedContent]);

  const unfollow = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_profile_id=${encodeURIComponent(targetProfileId)}`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
      refreshLockedContent();
    } finally {
      setLoading(false);
    }
  }, [targetProfileId, refreshLockedContent]);

  const cancelRequest = useCallback(async () => {
    if (!targetProfileId || !useAuthStore.getState().activeProfileId) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_profile_id=${encodeURIComponent(targetProfileId)}&cancel=1`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
      refreshLockedContent();
    } finally {
      setLoading(false);
    }
  }, [targetProfileId, refreshLockedContent]);

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
