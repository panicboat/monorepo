"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { profileRequestHeaders } from "@/lib/auth/profile-headers";
import { useAuthStore } from "@/stores/authStore";
import type { ProfileSummaryView } from "@/modules/profile/types";

interface ListResponse {
  requests: ProfileSummaryView[];
  nextCursor: string;
  hasMore: boolean;
}

interface CountResponse { count: number }

export function useFollowRequests({ enabled = true }: { enabled?: boolean } = {}) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const active = enabled && !!profileId;

  const { data: list, error: listError, isLoading, mutate: mutateList } = useSWR<ListResponse>(
    active ? "/api/social/follow/requests" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: countData, mutate: mutateCount } = useSWR<CountResponse>(
    active ? "/api/social/follow/requests/count" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const approve = useCallback(async (requesterProfileId: string) => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    const res = await fetch(`/api/social/follow/requests/${requesterProfileId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...profileRequestHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to approve");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.profileId !== requesterProfileId) } : cur), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  const reject = useCallback(async (requesterProfileId: string) => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    const res = await fetch(`/api/social/follow/requests/${requesterProfileId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...profileRequestHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to reject");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.profileId !== requesterProfileId) } : cur), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  return {
    requests: list?.requests || [],
    hasMore: list?.hasMore || false,
    nextCursor: list?.nextCursor || "",
    pendingCount: countData?.count || 0,
    loading: isLoading,
    error: listError,
    approve,
    reject,
    refresh: () => { mutateList(); mutateCount(); },
  };
}
