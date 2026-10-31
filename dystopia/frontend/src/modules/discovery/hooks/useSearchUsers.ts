"use client";

import { useEffect, useState } from "react";
import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedUsersResponse } from "../types";

const DEBOUNCE_MS = 300;

export type SearchUsersRoleFilter = 0 | 1 | 2;

export function useSearchUsers(query: string, roleFilter: SearchUsersRoleFilter = 0) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debounced.trim();
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedUsersResponse>(
    trimmed ? `/api/discovery/users?q=${encodeURIComponent(trimmed)}${roleFilter > 0 ? `&role=${roleFilter}` : ""}` : null
  );

  return {
    profiles: pages.flatMap((p) => p.profiles || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
    debouncedQuery: debounced,
  };
}
