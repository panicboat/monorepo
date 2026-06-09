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
  entries: Record<string, LikeEntry>;
  loading: boolean;

  /** Seed an entry only if not already present. Idempotent across re-mounts and SWR revalidates. */
  seed: (postId: string, liked: boolean, likesCount: number) => void;
  /** Force-overwrite an entry (use sparingly; for cases where server is authoritative). */
  set: (postId: string, entry: LikeEntry) => void;
  /** Toggle on. Returns the new likesCount, or null when unauthenticated. */
  like: (postId: string) => Promise<number | null>;
  /** Toggle off. Returns the new likesCount, or null when unauthenticated. */
  unlike: (postId: string) => Promise<number | null>;
  /** Convenience: pick like/unlike based on the current liked flag. */
  toggleLike: (postId: string, currentlyLiked: boolean) => Promise<number | null>;
  /** Batch-fetch initial like flags from the server. Does not mutate store state. */
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

  set: (postId, entry) => {
    set((s) => ({ entries: { ...s.entries, [postId]: entry } }));
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
