"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

interface LikeState {
  [postId: string]: {
    liked: boolean;
    likesCount: number;
  };
}

export function useLike() {
  const [likeState, setLikeState] = useState<LikeState>({});
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);

  const like = useCallback(
    async (postId: string) => {
      const token = accessToken;
      if (!token) {
        console.warn("Cannot like: not authenticated");
        return null;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/guest/likes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ postId }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to like post");
        }

        const data = await res.json();
        setLikeState((prev) => ({
          ...prev,
          [postId]: {
            liked: true,
            likesCount: data.likesCount,
          },
        }));
        return data.likesCount;
      } catch (e) {
        console.error("Like error:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const unlike = useCallback(
    async (postId: string) => {
      const token = accessToken;
      if (!token) {
        console.warn("Cannot unlike: not authenticated");
        return null;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/guest/likes?post_id=${postId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to unlike post");
        }

        const data = await res.json();
        setLikeState((prev) => ({
          ...prev,
          [postId]: {
            liked: false,
            likesCount: data.likesCount,
          },
        }));
        return data.likesCount;
      } catch (e) {
        console.error("Unlike error:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean) => {
      if (currentlyLiked) {
        return unlike(postId);
      }
      return like(postId);
    },
    [like, unlike]
  );

  const fetchLikeStatus = useCallback(
    async (postIds: string[]) => {
      if (postIds.length === 0) return {};

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      try {
        const res = await fetch(
          `/api/guest/likes/status?post_ids=${postIds.join(",")}`,
          { headers }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch like status");
        }

        const data = await res.json();
        return data.liked as Record<string, boolean>;
      } catch (e) {
        console.error("Fetch like status error:", e);
        return {};
      }
    },
    [accessToken]
  );

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
