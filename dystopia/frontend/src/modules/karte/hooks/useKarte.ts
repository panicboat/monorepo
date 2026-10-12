"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KarteEntry } from "../types";

export function useKarte(id: string | null) {
  const profileId = useAuthStore((state) => state.activeProfileId);
  const { data, error, isLoading, mutate } = useSWR<{ entry: KarteEntry }>(profileId && id ? `/api/karte/${id}` : null, fetcher);
  return { entry: data?.entry, error, loading: isLoading, refresh: mutate };
}
