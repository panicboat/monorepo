"use client";

import { useSocialStore, selectIsHydrated } from "@/stores/socialStore";

/**
 * useSocial Hook
 *
 * Thin wrapper around socialStore for backward compatibility.
 * Use useSocialStore directly for new code.
 */
export const useSocial = () => {
  const following = useSocialStore((state) => state.following);
  const blocking = useSocialStore((state) => state.blocking);
  const favorites = useSocialStore((state) => state.favorites);
  const isHydrated = useSocialStore(selectIsHydrated);

  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const toggleBlock = useSocialStore((state) => state.toggleBlock);
  const toggleFavorite = useSocialStore((state) => state.toggleFavorite);

  const isFollowing = useSocialStore((state) => state.isFollowing);
  const isBlocking = useSocialStore((state) => state.isBlocking);
  const isFavorite = useSocialStore((state) => state.isFavorite);

  return {
    following,
    blocking,
    favorites,
    toggleFollow,
    toggleBlock,
    toggleFavorite,
    isFollowing,
    isBlocking,
    isFavorite,
    isLoaded: isHydrated,
  };
};
