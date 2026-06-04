"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { AreaView } from "@/modules/profile/types";

interface AreasResponse {
  areas: AreaView[];
}

export function useAreas(prefecture?: string) {
  const key = prefecture
    ? `/api/areas?prefecture=${encodeURIComponent(prefecture)}`
    : "/api/areas";
  const { data, error, isLoading } = useSWR<AreasResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  return {
    areas: data?.areas ?? [],
    loading: isLoading,
    error,
  };
}
