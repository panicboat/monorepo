"use client";

import { useState, useCallback } from "react";
import { profileRequestHeaders } from "@/lib/auth/profile-headers";
import { useAuthStore } from "@/stores/authStore";

interface UseMediaResult {
  loading: boolean;
  error: Error | null;
  deleteMedia: (id: string) => Promise<boolean>;
}

export function useMedia(): UseMediaResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteMedia = useCallback(async (id: string): Promise<boolean> => {
    if (!useAuthStore.getState().activeProfileId) {
      throw new Error("ログインしてください");
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/media/${id}`, {
        method: "DELETE",
        headers: profileRequestHeaders(),
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
    deleteMedia,
  };
}
