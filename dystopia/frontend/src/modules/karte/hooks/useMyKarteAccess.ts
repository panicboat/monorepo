"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectRole } from "@/stores/authStore";
import type { KarteAccess } from "../types";

// Karte is cast-only; a guest's billing flag never grants real access, whatever the API returns.
export function hasKarteAccess(role: string | null, data: KarteAccess | undefined): boolean {
  return role === "cast" && !!data?.hasAccess;
}

export function useMyKarteAccess() {
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore(selectRole);
  const { data, error, isLoading } = useSWR<KarteAccess>(
    userId ? "/api/karte/access" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return {
    hasAccess: hasKarteAccess(role, data),
    grantedAt: data?.grantedAt ?? null,
    loading: isLoading,
    error,
  };
}
