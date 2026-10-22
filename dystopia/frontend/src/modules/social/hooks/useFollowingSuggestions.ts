"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedProfilesResponse } from "../types";

const DEBOUNCE_MS = 200;
const SUGGESTION_LIMIT = 5;

export function useFollowingSuggestions(query: string | null) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const key =
    activeProfileId && query !== null && debounced !== null
      ? `/api/social/following?limit=${SUGGESTION_LIMIT}&q=${encodeURIComponent(debounced)}`
      : null;
  const { data, isLoading } = useSWR<PaginatedProfilesResponse>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  return { profiles: key ? data?.profiles ?? [] : [], loading: isLoading };
}
