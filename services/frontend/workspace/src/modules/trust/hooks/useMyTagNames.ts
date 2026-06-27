"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

interface MyTagNamesResponse {
  tagNames: string[];
}

export function useMyTagNames() {
  const userId = useAuthStore((s) => s.userId);

  const { data, error, isLoading: loading } = useSWR<MyTagNamesResponse>(
    userId ? "/api/me/trust/tag-names" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    // FALLBACK: Returns empty array when data is not yet loaded
    tagNames: data?.tagNames || [],
    loading,
    error,
  };
}
