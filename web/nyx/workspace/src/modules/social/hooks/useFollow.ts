"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

interface FollowState {
  [castId: string]: boolean;
}

export function useFollow() {
  const [followState, setFollowState] = useState<FollowState>({});
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);

  const follow = useCallback(
    async (castId: string) => {
      const token = accessToken;
      if (!token) {
        console.warn("Cannot follow: not authenticated");
        return false;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/guest/following", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ castId }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to follow");
        }

        const data = await res.json();
        if (data.success) {
          setFollowState((prev) => ({ ...prev, [castId]: true }));
          setFollowingList((prev) =>
            prev.includes(castId) ? prev : [...prev, castId]
          );
        }
        return data.success;
      } catch (e) {
        console.error("Follow error:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const unfollow = useCallback(
    async (castId: string) => {
      const token = accessToken;
      if (!token) {
        console.warn("Cannot unfollow: not authenticated");
        return false;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/guest/following?cast_id=${castId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to unfollow");
        }

        const data = await res.json();
        if (data.success) {
          setFollowState((prev) => ({ ...prev, [castId]: false }));
          setFollowingList((prev) => prev.filter((id) => id !== castId));
        }
        return data.success;
      } catch (e) {
        console.error("Unfollow error:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const toggleFollow = useCallback(
    async (castId: string) => {
      const isCurrentlyFollowing = followState[castId];
      if (isCurrentlyFollowing) {
        return unfollow(castId);
      }
      return follow(castId);
    },
    [follow, unfollow, followState]
  );

  const fetchFollowingList = useCallback(
    async (limit: number = 100) => {
      if (!accessToken) {
        console.warn("Cannot fetch following: not authenticated");
        return [];
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/guest/following?limit=${limit}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch following list");
        }

        const data = await res.json();
        setFollowingList(data.castIds || []);

        // Update follow state
        const newState: FollowState = {};
        (data.castIds || []).forEach((id: string) => {
          newState[id] = true;
        });
        setFollowState(newState);

        return data.castIds as string[];
      } catch (e) {
        console.error("Fetch following list error:", e);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const fetchFollowStatus = useCallback(
    async (castIds: string[]) => {
      if (castIds.length === 0) return {};

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      try {
        const res = await fetch(
          `/api/guest/following/status?cast_ids=${castIds.join(",")}`,
          { headers }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch follow status");
        }

        const data = await res.json();

        // Update local state
        setFollowState((prev) => ({
          ...prev,
          ...data.following,
        }));

        return data.following as Record<string, boolean>;
      } catch (e) {
        console.error("Fetch follow status error:", e);
        return {};
      }
    },
    [accessToken]
  );

  const isFollowing = useCallback(
    (castId: string) => followState[castId] ?? false,
    [followState]
  );

  return {
    follow,
    unfollow,
    toggleFollow,
    fetchFollowingList,
    fetchFollowStatus,
    isFollowing,
    followingList,
    loading,
  };
}
