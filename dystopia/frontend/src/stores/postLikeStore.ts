import { create } from "zustand";

import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";

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
  // Keep entries for the tab lifetime so cards share like state across mounts.
  entries: Record<string, LikeEntry>;
  // Serialize mutations globally because low-throughput toggles do not need per-post loading.
  loading: boolean;

  seed: (postId: string, liked: boolean, likesCount: number) => void;
  like: (postId: string) => Promise<number | null>;
  unlike: (postId: string) => Promise<number | null>;
  toggleLike: (postId: string, currentlyLiked: boolean) => Promise<number | null>;
  fetchLikeStatus: (postIds: string[]) => Promise<Record<string, boolean>>;
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
    if (!useAuthStore.getState().accountId) {
      // FALLBACK: Return null when the user is not authenticated.
      console.warn("Cannot like: not authenticated");
      return null;
    }
    const sentAs = useAuthStore.getState().activeProfileId;
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "POST" }
      );
      if (useAuthStore.getState().activeProfileId === sentAs) {
        set((s) => ({
          entries: { ...s.entries, [postId]: { liked: true, likesCount: data.likesCount } },
        }));
      }
      return data.likesCount;
    } catch (e) {
      console.error("Like error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  unlike: async (postId) => {
    if (!useAuthStore.getState().accountId) {
      // FALLBACK: Return null when the user is not authenticated.
      console.warn("Cannot unlike: not authenticated");
      return null;
    }
    const sentAs = useAuthStore.getState().activeProfileId;
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "DELETE" }
      );
      if (useAuthStore.getState().activeProfileId === sentAs) {
        set((s) => ({
          entries: { ...s.entries, [postId]: { liked: false, likesCount: data.likesCount } },
        }));
      }
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

// Like state belongs to the acting profile; isLiked() prefers an entry over the server's answer, so entries must not survive a change of profile.
useAuthStore.subscribe((state, previous) => {
  if (state.activeProfileId !== previous.activeProfileId) usePostLikeStore.setState({ entries: {} });
});
