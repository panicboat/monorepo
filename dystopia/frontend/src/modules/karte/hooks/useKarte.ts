"use client";

import useSWR from "swr";
import { AppError } from "@/lib/errors";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useKarteRevalidation } from "../lib/revalidate";
import type { Karte } from "../types";

const NOT_FOUND = "Karte not found";

export function useKarte(karteId: string | null, initial?: Karte) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const key = profileId && karteId ? `/api/karte/${encodeURIComponent(karteId)}` : null;
  const { data, error, mutate } = useSWR<{ karte: Karte }>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    fallbackData: initial ? { karte: initial } : undefined,
  });
  useKarteRevalidation(mutate);

  return {
    karte: data?.karte ?? null,
    gone: error instanceof AppError && error.message === NOT_FOUND,
    error,
    refresh: () => mutate(),
    apply: (next: Karte) => mutate({ karte: next }, { revalidate: false }),
  };
}
