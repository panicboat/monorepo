"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { SocialCounts } from "../types";

export function useSocialCounts(profileId?: string) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId);
  const qs = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<SocialCounts>(
    activeProfileId ? `/api/social/counts${qs}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    followingCount: data?.followingCount ?? 0,
    followersCount: data?.followersCount ?? 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
