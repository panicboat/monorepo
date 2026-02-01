"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { fetcher } from "@/lib/swr";
import {
  useAuthStore,
  selectAccessToken,
  selectIsHydrated,
} from "@/stores/authStore";

export interface GuestProfile {
  userId: string;
  name: string;
  avatarPath: string;
  avatarUrl: string;
}

export interface GuestProfileFormData {
  name: string;
  avatarPath: string;
}

const INITIAL_PROFILE: GuestProfileFormData = {
  name: "",
  avatarPath: "",
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().accessToken;
};

interface UseGuestDataOptions {
  apiPath?: string;
}

interface GuestDataApiResponse {
  profile?: {
    userId: string;
    name: string;
    avatarPath: string;
    avatarUrl: string;
  };
}

/**
 * Hook for managing guest profile data.
 * Uses SWR for data fetching and caching.
 */
export function useGuestData(options: UseGuestDataOptions = {}) {
  const { apiPath = "/api/guest/profile" } = options;

  const accessToken = useAuthStore(selectAccessToken);
  const isHydrated = useAuthStore(selectIsHydrated);

  const { data, error, isLoading, mutate } = useSWR<GuestDataApiResponse>(
    isHydrated && accessToken ? apiPath : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      shouldRetryOnError: (err) => {
        if ((err as any).status === 404) return false;
        return true;
      },
      onError: (err) => {
        if ((err as any).status === 404) {
          return;
        }
        console.error("Failed to load guest data", err);
      },
    }
  );

  const profile = useMemo(
    (): GuestProfileFormData =>
      data?.profile
        ? { name: data.profile.name, avatarPath: data.profile.avatarPath }
        : INITIAL_PROFILE,
    [data?.profile]
  );

  const avatarUrl = useMemo(
    () => data?.profile?.avatarUrl || "",
    [data?.profile]
  );

  const updateProfile = useCallback(
    (updates: Partial<GuestProfileFormData>) => {
      mutate(
        (currentData) => {
          const existingProfile = currentData?.profile || {
            userId: "",
            name: "",
            avatarPath: "",
            avatarUrl: "",
          };
          return {
            ...currentData,
            profile: {
              ...existingProfile,
              name: updates.name ?? existingProfile.name,
              avatarPath: updates.avatarPath ?? existingProfile.avatarPath,
            },
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const saveProfile = useCallback(
    async (overrideProfile?: GuestProfileFormData) => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("ログインが必要です");

      const profileToSave = overrideProfile || profile;

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          name: profileToSave.name,
          avatarPath: profileToSave.avatarPath || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save profile");
      }

      mutate();
      return res.json();
    },
    [apiPath, profile, mutate]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<{ key: string; url: string }> => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("ログインが必要です");

      const res = await fetch("/api/guest/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { url, key } = await res.json();

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image");

      return { key, url: URL.createObjectURL(file) };
    },
    []
  );

  const fetchData = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    // Data
    profile,
    avatarUrl,

    // Meta
    loading: !isHydrated || isLoading,
    initialized: isHydrated && !isLoading,
    error,
    hasProfile: !!data?.profile,
    isAuthenticated: !!accessToken,

    // Fetch
    fetchData,

    // Update (local cache)
    updateProfile,

    // Save (to server)
    saveProfile,
    uploadAvatar,

    // SWR mutate
    mutate,
  };
}
