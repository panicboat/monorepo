"use client";

import { useEffect, useState } from "react";
import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedPostsResponse } from "../types";

const DEBOUNCE_MS = 300;

export function useSearchPosts(query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debounced.trim();
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedPostsResponse>(
    trimmed ? `/api/discovery/posts?q=${encodeURIComponent(trimmed)}` : null
  );

  return {
    posts: pages.flatMap((p) => p.posts || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
    debouncedQuery: debounced,
  };
}
