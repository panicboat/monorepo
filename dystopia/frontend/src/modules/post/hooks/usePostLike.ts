"use client";

import { useShallow } from "zustand/react/shallow";

import { usePostLikeStore } from "@/stores/postLikeStore";

/**
 * Subscribes to the shared post-like store.
 * Returns the same shape as before the Zustand hoist (Q4b follow-up):
 * state is now singleton across instances, so multiple PostCardBinding rendering
 * the same post stay in sync after a like toggle.
 *
 * `setInitialState` has idempotent seed semantics: it only writes when the entry
 * is absent. Re-mounts and SWR revalidates that re-inject the original snapshot
 * therefore cannot clobber the user's latest toggle.
 */
export function usePostLike() {
  // Reactive selectors — re-render only when shallow-equal slice changes.
  const { entries, loading } = usePostLikeStore(
    useShallow((s) => ({ entries: s.entries, loading: s.loading }))
  );

  // Stable action handles (zustand store functions are referentially stable).
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
    /** Alias preserved for callers that expect setInitialState. Behavior is idempotent seed. */
    setInitialState: seed,
    isLiked: (postId: string, fallback = false) => entries[postId]?.liked ?? fallback,
    getLikesCount: (postId: string, fallback = 0) =>
      entries[postId]?.likesCount ?? fallback,
    state: entries,
    loading,
  };
}
