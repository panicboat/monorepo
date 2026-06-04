"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { ProfileView } from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function usePublicProfile(username: string | null) {
  const token = getAuthToken();
  const { data, error, isLoading } = useSWR<ProfileResponse>(
    token && username ? `/api/profile/by-username/${encodeURIComponent(username)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
  };
}
