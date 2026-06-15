"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { FollowRequestItem } from "../types";

interface ListResponse {
  requests: FollowRequestItem[];
  nextCursor: string;
  hasMore: boolean;
}

interface CountResponse { count: number }

export function useFollowRequests() {
  const token = getAuthToken();

  const { data: list, error: listError, isLoading, mutate: mutateList } = useSWR<ListResponse>(
    token ? "/api/social/follow/requests" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: countData, mutate: mutateCount } = useSWR<CountResponse>(
    token ? "/api/social/follow/requests/count" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const approve = useCallback(async (requesterAccountId: string) => {
    const t = getAuthToken();
    if (!t) throw new Error("No token");
    const res = await fetch(`/api/social/follow/requests/${requesterAccountId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to approve");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.requesterAccountId !== requesterAccountId) } : cur), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  const reject = useCallback(async (requesterAccountId: string) => {
    const t = getAuthToken();
    if (!t) throw new Error("No token");
    const res = await fetch(`/api/social/follow/requests/${requesterAccountId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to reject");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.requesterAccountId !== requesterAccountId) } : cur), { revalidate: false });
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
