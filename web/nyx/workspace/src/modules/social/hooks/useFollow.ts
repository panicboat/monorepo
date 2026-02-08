"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface FollowState {
  [castId: string]: boolean;
}

interface FollowResponse {
  success: boolean;
}

export interface FollowingCast {
  id: string;
  name: string;
  imageUrl: string;
  area: string;
}

interface FollowListResponse {
  castIds: string[];
  casts: FollowingCast[];
}

interface FollowStatusResponse {
  following: Record<string, boolean>;
}

export function useFollow() {
  const [followState, setFollowState] = useState<FollowState>({});
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followingCasts, setFollowingCasts] = useState<FollowingCast[]>([]);
  const [loading, setLoading] = useState(false);

  const follow = useCallback(async (castId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot follow: not authenticated");
      return false;
    }

    setLoading(true);
    try {
      const data = await authFetch<FollowResponse>("/api/guest/following", {
        method: "POST",
        body: { castId },
      });

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
  }, []);

  const unfollow = useCallback(async (castId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot unfollow: not authenticated");
      return false;
    }

    setLoading(true);
    try {
      const data = await authFetch<FollowResponse>(
        `/api/guest/following?cast_id=${castId}`,
        { method: "DELETE" }
      );

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
  }, []);

  const toggleFollow = useCallback(
    async (castId: string) => {
      return followState[castId] ? unfollow(castId) : follow(castId);
    },
    [follow, unfollow, followState]
  );

  const fetchFollowingList = useCallback(async (limit: number = 100) => {
    if (!getAuthToken()) {
      console.warn("Cannot fetch following: not authenticated");
      return { castIds: [], casts: [] };
    }

    setLoading(true);
    try {
      const data = await authFetch<FollowListResponse>(
        `/api/guest/following?limit=${limit}`
      );

      const castIds = data.castIds || [];
      const casts = data.casts || [];
      setFollowingList(castIds);
      setFollowingCasts(casts);

      const newState: FollowState = {};
      castIds.forEach((id) => {
        newState[id] = true;
      });
      setFollowState(newState);

      return { castIds, casts };
    } catch (e) {
      console.error("Fetch following list error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFollowStatus = useCallback(async (castIds: string[]) => {
    if (castIds.length === 0) return {};

    try {
      const data = await authFetch<FollowStatusResponse>(
        `/api/guest/following/status?cast_ids=${castIds.join(",")}`,
        { requireAuth: false }
      );

      setFollowState((prev) => ({
        ...prev,
        ...data.following,
      }));

      return data.following;
    } catch (e) {
      console.error("Fetch follow status error:", e);
      throw e;
    }
  }, []);

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
    followingCasts,
    loading,
  };
}
