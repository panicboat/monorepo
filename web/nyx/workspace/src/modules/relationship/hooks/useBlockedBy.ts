"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";

interface BlockedByUser {
  id: string;
  userType: string;
  name: string;
  imageUrl: string;
  blockedAt: string;
}

interface BlockedByResponse {
  blockers: BlockedByUser[];
}

export function useBlockedBy(guestId: string) {
  const { data, error, isLoading, mutate } = useSWR<BlockedByResponse>(
    guestId ? `/api/cast/guests/${guestId}/blocked-by` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    blockers: data?.blockers || [],
    loading: isLoading,
    error,
    mutate,
  };
}
