"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/auth";
import type { MediaItem } from "../types";
import { mapApiToMediaItem, mapApiToMediaList } from "../lib/mappers";

interface UseMediaResult {
  loading: boolean;
  error: Error | null;
  getMedia: (id: string) => Promise<MediaItem | null>;
  getMediaBatch: (ids: string[]) => Promise<MediaItem[]>;
  deleteMedia: (id: string) => Promise<boolean>;
}

export function useMedia(): UseMediaResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getMedia = useCallback(async (id: string): Promise<MediaItem | null> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No authentication token");
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/media/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get media");
      }

      const data = await res.json();
      return data.media ? mapApiToMediaItem(data.media) : null;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Failed to get media");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMediaBatch = useCallback(
    async (ids: string[]): Promise<MediaItem[]> => {
      if (ids.length === 0) return [];

      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/media/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get media batch");
        }

        const data = await res.json();
        return mapApiToMediaList(data.media || []);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Failed to get media batch");
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteMedia = useCallback(async (id: string): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No authentication token");
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/media/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete media");
      }

      const data = await res.json();
      return data.success === true;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Failed to delete media");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getMedia,
    getMediaBatch,
    deleteMedia,
  };
}
