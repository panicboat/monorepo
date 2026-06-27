"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { authFetch } from "@/lib/auth/fetch";
import type {
  ProfileView,
  SaveProfilePayload,
  SaveProfileMediaPayload,
} from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function useProfile() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    userId ? "/api/profile" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const saveProfile = useCallback(
    async (payload: SaveProfilePayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile", {
        method: "PUT",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  const saveMedia = useCallback(
    async (payload: SaveProfileMediaPayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile/media", {
        method: "POST",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
    saveProfile,
    saveMedia,
    mutate,
  };
}
