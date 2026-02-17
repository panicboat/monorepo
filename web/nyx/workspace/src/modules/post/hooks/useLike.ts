"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface LikeState {
  [postId: string]: {
    liked: boolean;
    likesCount: number;
  };
}

interface LikeResponse {
  likesCount: number;
}

interface LikeStatusResponse {
  liked: Record<string, boolean>;
}

export function useLike() {
  const [likeState, setLikeState] = useState<LikeState>({});
  const [loading, setLoading] = useState(false);

  const like = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot like: not authenticated");
      return null;
    }

    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>("/api/guest/likes", {
        method: "POST",
        body: { postId },
      });

      setLikeState((prev) => ({
        ...prev,
        [postId]: { liked: true, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Like error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const unlike = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot unlike: not authenticated");
      return null;
    }

    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>(
        `/api/guest/likes?post_id=${postId}`,
        { method: "DELETE" }
      );

      setLikeState((prev) => ({
        ...prev,
        [postId]: { liked: false, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Unlike error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean) => {
      return currentlyLiked ? unlike(postId) : like(postId);
    },
    [like, unlike]
  );

  const fetchLikeStatus = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return {};

    try {
      const data = await authFetch<LikeStatusResponse>(
        `/api/guest/likes/status?post_ids=${postIds.join(",")}`,
        { requireAuth: false }
      );
      return data.liked;
    } catch (e) {
      console.error("Fetch like status error:", e);
      return {};
    }
  }, []);

  const isLiked = useCallback(
    (postId: string) => likeState[postId]?.liked ?? false,
    [likeState]
  );

  const getLikesCount = useCallback(
    (postId: string, defaultCount: number = 0) =>
      likeState[postId]?.likesCount ?? defaultCount,
    [likeState]
  );

  const setInitialState = useCallback(
    (postId: string, liked: boolean, likesCount: number) => {
      setLikeState((prev) => ({
        ...prev,
        [postId]: { liked, likesCount },
      }));
    },
    []
  );

  return {
    like,
    unlike,
    toggleLike,
    fetchLikeStatus,
    isLiked,
    getLikesCount,
    setInitialState,
    loading,
    likeState,
  };
}
