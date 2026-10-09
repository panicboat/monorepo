"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { ProfileView } from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function usePublicProfile(username: string | null) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    profileId && username ? `/api/profile/by-username/${encodeURIComponent(username)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
    mutate,
  };
}
