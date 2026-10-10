"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { ThreadDetailResponse } from "../types";

export function useThread(threadId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, isLoading } = useSWR<ThreadDetailResponse>(
    profileId && threadId ? `/api/messaging/threads/${encodeURIComponent(threadId)}` : null,
    fetcher
  );
  return {
    thread: data?.thread ?? null,
    sendRestriction: data?.sendRestriction ?? "none",
    loading: isLoading,
    error,
  };
}
