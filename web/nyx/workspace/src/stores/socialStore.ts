/**
 * Social Store
 *
 * Zustand store for social state management.
 * Handles following, blocking, and favorites with localStorage persistence.
 *
 * TODO: Currently stores social data in localStorage (client-only).
 *       Should be synced with the server via Social gRPC service when implemented.
 *       - toggleFollow should call Social::FollowService
 *       - toggleBlock should call Social::BlockService
 *       - Initial state should be fetched from server on hydration
 *
 * Usage:
 *   const { following, toggleFollow, isFollowing } = useSocialStore();
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SocialState {
  // State
  following: string[];
  blocking: string[];
  favorites: string[];
  isHydrated: boolean;

  // Actions
  toggleFollow: (castId: string) => void;
  toggleBlock: (targetId: string) => void;
  toggleFavorite: (castId: string) => void;
  setHydrated: () => void;

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

      // Computed
      isFollowing: (castId: string) => get().following.includes(castId),
      isBlocking: (targetId: string) => get().blocking.includes(targetId),
      isFavorite: (castId: string) => get().favorites.includes(castId),
    }),
    {
      name: "nyx-social",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        following: state.following,
        blocking: state.blocking,
        favorites: state.favorites,
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
