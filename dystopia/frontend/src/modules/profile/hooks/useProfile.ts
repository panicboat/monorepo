"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { authFetch } from "@/lib/auth/fetch";
import { isAppError } from "@/lib/errors";
import { emptyProfileView } from "@/modules/profile/lib/mappers";
import type {
  ProfileView,
  SaveProfilePayload,
  SaveProfileMediaPayload,
} from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

// A fresh account 404s on GetProfile until SaveProfile upserts the row; treat that as an empty editable profile instead of an error.
export async function fetchProfileOrEmpty(url: string, accountId: string): Promise<ProfileResponse> {
  try {
    return await fetcher<ProfileResponse>(url);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") {
      return { profile: emptyProfileView(accountId) };
    }
    throw error;
  }
}

export function useProfile() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    userId ? "/api/profile" : null,
    (url: string) => fetchProfileOrEmpty(url, userId!),
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
