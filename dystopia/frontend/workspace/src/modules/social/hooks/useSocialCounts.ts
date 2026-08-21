"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { SocialCounts } from "../types";

export function useSocialCounts(accountId?: string) {
  const userId = useAuthStore((s) => s.userId);
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<SocialCounts>(
    userId ? `/api/social/counts${qs}` : null,
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
