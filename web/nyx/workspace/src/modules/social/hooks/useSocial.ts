"use client";

import { useEffect, useState } from "react";

type SocialState = {
  following: string[]; // List of Cast IDs
  blocking: string[]; // List of User IDs (or Cast IDs)
  favorites: string[]; // List of Cast IDs
};

const STORAGE_KEY = "nyx_social_state";

export const useSocial = () => {
  const [state, setState] = useState<SocialState>({
    following: [],
    blocking: [],
    favorites: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState({
          following: [],
          blocking: [],
          favorites: [],
          ...JSON.parse(stored),
        });
      } catch (e) {
        console.error("Failed to parse social state", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const toggleFollow = (castId: string) => {
    setState((prev) => {
      const isFollowing = prev.following.includes(castId);
      return {
        ...prev,
        following: isFollowing
          ? prev.following.filter((id) => id !== castId)
          : [...prev.following, castId],
      };
    });
  };

  const toggleBlock = (targetId: string) => {
    setState((prev) => {
      const isBlocking = prev.blocking.includes(targetId);
      return {
        ...prev,
        blocking: isBlocking
          ? prev.blocking.filter((id) => id !== targetId)
          : [...prev.blocking, targetId],
      };
    });
  };

  const toggleFavorite = (castId: string) => {
    setState((prev) => {
      const isFavorite = prev.favorites?.includes(castId) ?? false;
      const currentFavorites = prev.favorites ?? [];

      return {
        ...prev,
        favorites: isFavorite
          ? currentFavorites.filter((id) => id !== castId)
          : [...currentFavorites, castId],
      };
    });
  };

  const isFollowing = (castId: string) => state.following.includes(castId);
  const isBlocking = (targetId: string) => state.blocking.includes(targetId);
  const isFavorite = (castId: string) =>
    state.favorites?.includes(castId) ?? false;

  return {
    following: state.following,
    blocking: state.blocking,
    favorites: state.favorites,
    toggleFollow,
    toggleBlock,
    toggleFavorite,
    isFollowing,
    isBlocking,
    isFavorite,
    isLoaded,
  };
};
