"use client";

import { useShallow } from "zustand/react/shallow";

import { usePostLikeStore } from "@/stores/postLikeStore";

export function usePostLike() {
  const { entries, loading } = usePostLikeStore(
    useShallow((s) => ({ entries: s.entries, loading: s.loading }))
  );

  const like = usePostLikeStore((s) => s.like);
  const unlike = usePostLikeStore((s) => s.unlike);
  const toggleLike = usePostLikeStore((s) => s.toggleLike);
  const fetchLikeStatus = usePostLikeStore((s) => s.fetchLikeStatus);
  const seed = usePostLikeStore((s) => s.seed);

  return {
    like,
    unlike,
    toggleLike,
    fetchLikeStatus,
    setInitialState: seed,
    isLiked: (postId: string, fallback = false) => entries[postId]?.liked ?? fallback,
    getLikesCount: (postId: string, fallback = 0) =>
      entries[postId]?.likesCount ?? fallback,
    state: entries,
    loading,
  };
}
