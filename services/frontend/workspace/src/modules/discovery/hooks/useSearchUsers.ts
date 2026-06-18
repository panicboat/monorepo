"use client";

import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedUsersResponse } from "../types";

const DEBOUNCE_MS = 300;

// 0 = all, 1 = guest only, 2 = cast only
export type SearchUsersRoleFilter = 0 | 1 | 2;

export function useSearchUsers(query: string, roleFilter: SearchUsersRoleFilter = 0) {
  const token = getAuthToken();
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const getKey = (pageIndex: number, prev: PaginatedUsersResponse | null): string | null => {
    if (!token) return null;
    const trimmed = debounced.trim();
    if (trimmed.length === 0) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const roleQs = roleFilter > 0 ? `&role=${roleFilter}` : "";
    return `/api/discovery/users?q=${encodeURIComponent(trimmed)}${cursorQs}${roleQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedUsersResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
    debouncedQuery: debounced,
  };
}
