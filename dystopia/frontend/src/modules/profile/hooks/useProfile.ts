"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { authFetch } from "@/lib/auth/fetch";
import { addToMyProfiles } from "@/modules/profile/lib/session";
import type {
  CreateProfilePayload,
  ProfileView,
  SaveProfilePayload,
  SaveProfileMediaPayload,
} from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function useProfile() {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
  const { mutate: mutateCache } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    activeProfileId ? (["/api/profile", activeProfileId] as const) : null,
    ([url]: readonly [string, string]) => fetcher<ProfileResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const createProfile = useCallback(
    async (payload: CreateProfilePayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile", {
        method: "POST",
        body: payload,
      });
      const accountId = useAuthStore.getState().accountId;
      if (!accountId) return res.profile;
      // Put the new profile into the cached list first; a stale empty list would resolve back to onboarding.
      await addToMyProfiles(mutateCache, accountId, res.profile);
      setActiveProfile(res.profile.id);
      return res.profile;
    },
    [setActiveProfile, mutateCache]
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
    createProfile,
    saveProfile,
    saveMedia,
    mutate,
  };
}
