"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";

interface MyTagNamesResponse {
  tagNames: string[];
}

export function useMyTagNames() {
  const token = getAuthToken();

  const { data, error, isLoading: loading } = useSWR<MyTagNamesResponse>(
    token ? "/api/me/trust/tag-names" : null,
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
