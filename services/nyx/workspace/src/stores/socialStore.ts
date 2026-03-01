/**
 * Social Store
 *
 * Zustand store for social state management.
 * Handles following state synced with the backend API.
 *
 * Usage:
 *   const { following, toggleFollow, isFollowing, setFollowing } = useSocialStore();
 */

import { create } from "zustand";

interface SocialState {
  // State
  following: string[];
  isHydrated: boolean;
  isSynced: boolean;

  // Actions
  toggleFollow: (castId: string) => void;
  setHydrated: () => void;
  setFollowing: (castIds: string[]) => void;
  addFollowing: (castId: string) => void;
  removeFollowing: (castId: string) => void;
  setSynced: (synced: boolean) => void;

  // Computed
  isFollowing: (castId: string) => boolean;
}

export const useSocialStore = create<SocialState>()((set, get) => ({
  // Initial state
  following: [],
  isHydrated: true,
  isSynced: false,

  // Actions
  toggleFollow: (castId: string) => {
    const { following } = get();
    const isFollowing = following.includes(castId);
    set({
      following: isFollowing
        ? following.filter((id) => id !== castId)
        : [...following, castId],
    });
  },

  setHydrated: () => set({ isHydrated: true }),

  setFollowing: (castIds: string[]) => set({ following: castIds, isSynced: true }),

  addFollowing: (castId: string) => {
    const { following } = get();
    if (!following.includes(castId)) {
      set({ following: [...following, castId] });
    }
  },

  removeFollowing: (castId: string) => {
    const { following } = get();
    set({ following: following.filter((id) => id !== castId) });
  },

  setSynced: (synced: boolean) => set({ isSynced: synced }),

  // Computed
  isFollowing: (castId: string) => get().following.includes(castId),
}));

/**
 * Selectors for common use cases
 */
export const selectFollowing = (state: SocialState) => state.following;
export const selectIsHydrated = (state: SocialState) => state.isHydrated;
export const selectIsSynced = (state: SocialState) => state.isSynced;
