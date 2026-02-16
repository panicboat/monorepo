"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { FavoriteCast, FavoriteState } from "../types";

interface FavoriteResponse {
  success: boolean;
}

interface FavoriteListResponse {
  castIds: string[];
  casts: FavoriteCast[];
}

interface FavoriteStatusResponse {
  favorited: Record<string, boolean>;
}

export function useFavorite() {
  const [favoriteState, setFavoriteState] = useState<FavoriteState>({});
  const [favoritesList, setFavoritesList] = useState<string[]>([]);
  const [favoriteCasts, setFavoriteCasts] = useState<FavoriteCast[]>([]);
  const [loading, setLoading] = useState(false);

  const addFavorite = useCallback(async (castId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot add favorite: not authenticated");
      return false;
    }

    setLoading(true);
    try {
      const data = await authFetch<FavoriteResponse>("/api/guest/favorites", {
        method: "POST",
        body: { castId },
      });

      if (data.success) {
        setFavoriteState((prev) => ({ ...prev, [castId]: true }));
        setFavoritesList((prev) =>
          prev.includes(castId) ? prev : [...prev, castId]
        );
      }
      return data.success;
    } catch (e) {
      console.error("Add favorite error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFavorite = useCallback(async (castId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot remove favorite: not authenticated");
      return false;
    }

    setLoading(true);
    try {
      const data = await authFetch<FavoriteResponse>(
        `/api/guest/favorites?cast_id=${castId}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setFavoriteState((prev) => ({ ...prev, [castId]: false }));
        setFavoritesList((prev) => prev.filter((id) => id !== castId));
      }
      return data.success;
    } catch (e) {
      console.error("Remove favorite error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (castId: string) => {
      return favoriteState[castId] ? removeFavorite(castId) : addFavorite(castId);
    },
    [addFavorite, removeFavorite, favoriteState]
  );

  const fetchFavoritesList = useCallback(async (limit: number = 100) => {
    if (!getAuthToken()) {
      console.warn("Cannot fetch favorites: not authenticated");
      return { castIds: [], casts: [] };
    }

    setLoading(true);
    try {
      const data = await authFetch<FavoriteListResponse>(
        `/api/guest/favorites?limit=${limit}`
      );

      const castIds = data.castIds || [];
      const casts = data.casts || [];
      setFavoritesList(castIds);
      setFavoriteCasts(casts);

      const newState: FavoriteState = {};
      castIds.forEach((id) => {
        newState[id] = true;
      });
      setFavoriteState(newState);

      return { castIds, casts };
    } catch (e) {
      console.error("Fetch favorites list error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFavoriteStatus = useCallback(async (castIds: string[]) => {
    if (castIds.length === 0) return {};

    try {
      const data = await authFetch<FavoriteStatusResponse>(
        `/api/guest/favorites/status?cast_ids=${castIds.join(",")}`,
        { requireAuth: false }
      );

      setFavoriteState((prev) => ({
        ...prev,
        ...data.favorited,
      }));

      return data.favorited;
    } catch (e) {
      console.error("Fetch favorite status error:", e);
      throw e;
    }
  }, []);

  const isFavorite = useCallback(
    (castId: string) => favoriteState[castId] ?? false,
    [favoriteState]
  );

  return {
    addFavorite,
    removeFavorite,
    toggleFavorite,
    fetchFavoritesList,
    fetchFavoriteStatus,
    isFavorite,
    favoritesList,
    favoriteCasts,
    loading,
  };
}
