"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KarteAccess } from "../types";

export function useMyKarteAccess() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading } = useSWR<KarteAccess>(
    userId ? "/api/karte/access" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return {
    hasAccess: !!data?.hasAccess,
    grantedAt: data?.grantedAt ?? null,
    loading: isLoading,
    error,
  };
}
