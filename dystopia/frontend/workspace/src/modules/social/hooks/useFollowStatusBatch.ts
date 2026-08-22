"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
import type { FollowStatusMap } from "../types";

interface Response { statuses: FollowStatusMap }

export function useFollowStatusBatch(targetAccountIds: string[]) {
  const [statuses, setStatuses] = useState<FollowStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = targetAccountIds.join(",");

  useEffect(() => {
    if (!useAuthStore.getState().userId || targetAccountIds.length === 0) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await authFetch<Response>(
          "/api/social/follow/status",
          { method: "POST", body: { targetAccountIds } }
        );
        if (cancelled) return;
        setStatuses(res.statuses || {});
      } catch (e) {
        console.error("useFollowStatusBatch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const getStatus = (id: string): FollowStatus => statuses[id] ?? FollowStatus.NONE;

  return { statuses, getStatus, loading };
}
