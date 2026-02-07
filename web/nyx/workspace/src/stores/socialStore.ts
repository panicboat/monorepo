/**
 * Social Store
 *
 * Zustand store for social state management.
 * Handles following, blocking, and favorites.
 *
 * Following and favorites are synced with the backend API.
 * Blocking remains in localStorage for now.
 *
 * Usage:
 *   const { following, toggleFollow, isFollowing, syncFollowing } = useSocialStore();
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SocialState {
  // State
  following: string[];
  blocking: string[];
  favorites: string[];
  isHydrated: boolean;
  isSynced: boolean;
  isFavoritesSynced: boolean;

  // Actions
  toggleFollow: (castId: string) => void;
  toggleBlock: (targetId: string) => void;
  toggleFavorite: (castId: string) => void;
  setHydrated: () => void;
  setFollowing: (castIds: string[]) => void;
  addFollowing: (castId: string) => void;
  removeFollowing: (castId: string) => void;
  setSynced: (synced: boolean) => void;
  setFavorites: (castIds: string[]) => void;
  addFavorite: (castId: string) => void;
  removeFavorite: (castId: string) => void;
  setFavoritesSynced: (synced: boolean) => void;

  // Computed
  isFollowing: (castId: string) => boolean;
  isBlocking: (targetId: string) => boolean;
  isFavorite: (castId: string) => boolean;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      // Initial state
      following: [],
      blocking: [],
      favorites: [],
      isHydrated: false,
      isSynced: false,
      isFavoritesSynced: false,

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

      toggleBlock: (targetId: string) => {
        const { blocking } = get();
        const isBlocking = blocking.includes(targetId);
        set({
          blocking: isBlocking
            ? blocking.filter((id) => id !== targetId)
            : [...blocking, targetId],
        });
      },

      toggleFavorite: (castId: string) => {
        const { favorites } = get();
        const isFavorite = favorites.includes(castId);
        set({
          favorites: isFavorite
            ? favorites.filter((id) => id !== castId)
            : [...favorites, castId],
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

      setFavorites: (castIds: string[]) => set({ favorites: castIds, isFavoritesSynced: true }),

      addFavorite: (castId: string) => {
        const { favorites } = get();
        if (!favorites.includes(castId)) {
          set({ favorites: [...favorites, castId] });
        }
      },

      removeFavorite: (castId: string) => {
        const { favorites } = get();
        set({ favorites: favorites.filter((id) => id !== castId) });
      },

      setFavoritesSynced: (synced: boolean) => set({ isFavoritesSynced: synced }),

      // Computed
      isFollowing: (castId: string) => get().following.includes(castId),
      isBlocking: (targetId: string) => get().blocking.includes(targetId),
      isFavorite: (castId: string) => get().favorites.includes(castId),
    }),
    {
      name: "nyx-social",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist blocking locally
        // Following and favorites are synced with server
        blocking: state.blocking,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

/**
 * Selectors for common use cases
 */
export const selectFollowing = (state: SocialState) => state.following;
export const selectBlocking = (state: SocialState) => state.blocking;
export const selectFavorites = (state: SocialState) => state.favorites;
export const selectIsHydrated = (state: SocialState) => state.isHydrated;
export const selectIsSynced = (state: SocialState) => state.isSynced;
export const selectIsFavoritesSynced = (state: SocialState) => state.isFavoritesSynced;
