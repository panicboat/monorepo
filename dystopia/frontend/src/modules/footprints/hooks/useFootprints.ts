"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedFootprintsResponse } from "../types";

export function useFootprints() {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedFootprintsResponse>("/api/footprints/list");

  return {
    footprints: pages.flatMap((p) => p.footprints || []),
    hasMore,
    loading,
    loaded: pages.length > 0,
    error,
    loadMore,
    refresh,
  };
}
