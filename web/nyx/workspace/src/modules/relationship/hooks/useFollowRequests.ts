"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { FollowRequest } from "../types";

interface FollowRequestsResponse {
  requests: FollowRequest[];
  nextCursor: string;
  hasMore: boolean;
}

interface PendingCountResponse {
  count: number;
}

/**
 * Hook for managing follow requests (cast-side).
 * Allows casts to view and approve/reject pending follow requests.
 */
export function useFollowRequests() {
  const token = getAuthToken();

  // Fetch pending requests
  const {
    data: requestsData,
    error: requestsError,
    isLoading: requestsLoading,
    mutate: mutateRequests,
  } = useSWR<FollowRequestsResponse>(
    token ? "/api/cast/following/requests" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Fetch pending count
  const {
    data: countData,
    error: countError,
    mutate: mutateCount,
  } = useSWR<PendingCountResponse>(
    token ? "/api/cast/following/requests/count" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Approve a follow request
  const approve = useCallback(
    async (guestId: string) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error("No token");

      const res = await fetch(`/api/cast/following/requests/${guestId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve");
      }

      // Optimistically update the list
      mutateRequests(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            requests: current.requests.filter((r) => r.guestId !== guestId),
          };
        },
        { revalidate: false }
      );

      // Update count
      mutateCount(
        (current) => {
          if (!current) return current;
          return { count: Math.max(0, current.count - 1) };
        },
        { revalidate: false }
      );

      return res.json();
    },
    [mutateRequests, mutateCount]
  );

  // Reject a follow request
  const reject = useCallback(
    async (guestId: string) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error("No token");

      const res = await fetch(`/api/cast/following/requests/${guestId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject");
      }

      // Optimistically update the list
      mutateRequests(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            requests: current.requests.filter((r) => r.guestId !== guestId),
          };
        },
        { revalidate: false }
      );

      // Update count
      mutateCount(
        (current) => {
          if (!current) return current;
          return { count: Math.max(0, current.count - 1) };
        },
        { revalidate: false }
      );

      return res.json();
    },
    [mutateRequests, mutateCount]
  );

  // Refresh data
  const refresh = useCallback(() => {
    mutateRequests();
    mutateCount();
  }, [mutateRequests, mutateCount]);

  return {
    // Data
    requests: requestsData?.requests || [],
    hasMore: requestsData?.hasMore || false,
    nextCursor: requestsData?.nextCursor || "",
    pendingCount: countData?.count || 0,

    // State
    loading: requestsLoading,
    error: requestsError || countError,

    // Actions
    approve,
    reject,
    refresh,
  };
}
