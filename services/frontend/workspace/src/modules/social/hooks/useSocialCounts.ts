"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { SocialCounts } from "../types";

export function useSocialCounts(accountId?: string) {
  const token = getAuthToken();
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<SocialCounts>(
    token ? `/api/social/counts${qs}` : null,
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
