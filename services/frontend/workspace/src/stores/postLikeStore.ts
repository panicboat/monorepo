import { create } from "zustand";

import { authFetch } from "@/lib/auth/fetch";
import { getAuthToken } from "@/lib/swr";

export interface LikeEntry {
  liked: boolean;
  likesCount: number;
}

interface LikeApiResponse {
  likesCount: number;
}

interface LikeStatusResponse {
  liked: Record<string, boolean>;
}

interface PostLikeState {
  /**
   * Per-post like state, keyed by post id. Lifetime = tab session; entries are
   * never evicted (Zustand store outlives any component mount). Each entry is
   * ~24 bytes; even a 10k-row feed adds <300KB which is acceptable for the
   * UX win of cross-instance sync. Add `evict(postIds)` if a long-running tab
   * accumulates more than that.
   */
  entries: Record<string, LikeEntry>;
  /**
   * Globally serialized loading flag for any in-flight like/unlike. Single-shot:
   * one click disables all like buttons until the request resolves. Acceptable
   * given like throughput is low and a per-postId loading map adds complexity
   * for negligible UX gain. Revisit if feed-scale parallel toggles emerge.
   */
  loading: boolean;

  /** Seed an entry only if not already present. Idempotent across re-mounts and SWR revalidates. */
  seed: (postId: string, liked: boolean, likesCount: number) => void;
  /** Toggle on. Returns the new likesCount, or null when unauthenticated. */
  like: (postId: string) => Promise<number | null>;
  /** Toggle off. Returns the new likesCount, or null when unauthenticated. */
  unlike: (postId: string) => Promise<number | null>;
  /** Convenience: pick like/unlike based on the current liked flag. */
  toggleLike: (postId: string, currentlyLiked: boolean) => Promise<number | null>;
  /**
   * Batch-fetch initial like flags from the server. Does not mutate store state —
   * callers (e.g. list pages hydrating multiple cards) decide whether to call
   * `seed(postId, liked, count)` per result. Keeping fetch pure lets callers
   * reconcile with their own pagination/dedup state.
   */
  fetchLikeStatus: (postIds: string[]) => Promise<Record<string, boolean>>;
  /** Selectors */
  isLiked: (postId: string, fallback?: boolean) => boolean;
  getLikesCount: (postId: string, fallback?: number) => number;
}

export const usePostLikeStore = create<PostLikeState>()((set, get) => ({
  entries: {},
  loading: false,

  seed: (postId, liked, likesCount) => {
    if (get().entries[postId]) return;
    set((s) => ({ entries: { ...s.entries, [postId]: { liked, likesCount } } }));
  },

  like: async (postId) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot like: not authenticated");
      return null;
    }
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "POST" }
      );
      set((s) => ({
        entries: { ...s.entries, [postId]: { liked: true, likesCount: data.likesCount } },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Like error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  unlike: async (postId) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot unlike: not authenticated");
      return null;
    }
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "DELETE" }
      );
      set((s) => ({
        entries: { ...s.entries, [postId]: { liked: false, likesCount: data.likesCount } },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Unlike error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  toggleLike: async (postId, currentlyLiked) => {
    return currentlyLiked ? get().unlike(postId) : get().like(postId);
  },

  fetchLikeStatus: async (postIds) => {
    if (postIds.length === 0) return {};
    const data = await authFetch<LikeStatusResponse>(
      `/api/posts/likes/status?post_ids=${encodeURIComponent(postIds.join(","))}`,
      { method: "GET" }
    );
    return data.liked || {};
  },

  isLiked: (postId, fallback = false) => get().entries[postId]?.liked ?? fallback,
  getLikesCount: (postId, fallback = 0) => get().entries[postId]?.likesCount ?? fallback,
}));
