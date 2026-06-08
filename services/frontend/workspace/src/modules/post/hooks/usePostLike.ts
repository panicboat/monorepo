"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { getAuthToken } from "@/lib/swr";

interface LikeEntry {
  liked: boolean;
  likesCount: number;
}

interface LikeResponse {
  likesCount: number;
}

interface LikeStatusResponse {
  liked: Record<string, boolean>;
}

export function usePostLike() {
  const [state, setState] = useState<Record<string, LikeEntry>>({});
  const [loading, setLoading] = useState(false);

  const like = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot like: not authenticated");
      return null;
    }
    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "POST" }
      );
      setState((prev) => ({
        ...prev,
        [postId]: { liked: true, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } finally {
      setLoading(false);
    }
  }, []);

  const unlike = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot unlike: not authenticated");
      return null;
    }
    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "DELETE" }
      );
      setState((prev) => ({
        ...prev,
        [postId]: { liked: false, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean) =>
      currentlyLiked ? unlike(postId) : like(postId),
    [like, unlike]
  );

  const fetchLikeStatus = useCallback(
    async (postIds: string[]): Promise<Record<string, boolean>> => {
      if (postIds.length === 0) return {};
      const data = await authFetch<LikeStatusResponse>(
        `/api/posts/likes/status?post_ids=${encodeURIComponent(postIds.join(","))}`,
        { method: "GET" }
      );
      return data.liked || {};
    },
    []
  );

  const setInitialState = useCallback(
    (postId: string, liked: boolean, likesCount: number) => {
      setState((prev) => ({
        ...prev,
        [postId]: { liked, likesCount },
      }));
    },
    []
  );

  const isLiked = useCallback(
    (postId: string, fallback = false) => state[postId]?.liked ?? fallback,
    [state]
  );
  const getLikesCount = useCallback(
    (postId: string, fallback = 0) => state[postId]?.likesCount ?? fallback,
    [state]
  );

  return {
    like,
    unlike,
    toggleLike,
    fetchLikeStatus,
    setInitialState,
    isLiked,
    getLikesCount,
    state,
    loading,
  };
}
