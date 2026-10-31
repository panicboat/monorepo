"use client";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { authFetch } from "@/lib/auth/fetch";
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

  const getKey = (pageIndex: number, prev: ListResponse | null): string | null => {
    if (!active) return null;
    if (prev && !prev.hasMore) return null;
    return pageIndex === 0 ? "/api/social/follow/requests" : `/api/social/follow/requests?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
  };

  const { data: pages, error: listError, isLoading, isValidating, size, setSize, mutate: mutateList } = useSWRInfinite<ListResponse>(
    getKey,
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
    await authFetch(`/api/social/follow/requests/${requesterProfileId}/approve`, { method: "POST" });
    mutateList((cur) => cur?.map((page) => ({ ...page, requests: page.requests.filter((r) => r.profileId !== requesterProfileId) })), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  const reject = useCallback(async (requesterProfileId: string) => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    await authFetch(`/api/social/follow/requests/${requesterProfileId}/reject`, { method: "POST" });
    mutateList((cur) => cur?.map((page) => ({ ...page, requests: page.requests.filter((r) => r.profileId !== requesterProfileId) })), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  const approveAll = useCallback(async () => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    await authFetch("/api/social/follow/requests/approve-all", { method: "POST" });
    await Promise.all([mutateList(), mutateCount()]);
  }, [mutateList, mutateCount]);

  const loaded = pages || [];

  return {
    requests: loaded.flatMap((page) => page.requests || []),
    hasMore: loaded.length > 0 ? !!loaded[loaded.length - 1].hasMore : false,
    loadMore: () => setSize(size + 1),
    pendingCount: countData?.count || 0,
    loading: isLoading,
    loadingMore: isValidating,
    error: listError,
    approve,
    reject,
    approveAll,
    refresh: () => { mutateList(); mutateCount(); },
  };
}
