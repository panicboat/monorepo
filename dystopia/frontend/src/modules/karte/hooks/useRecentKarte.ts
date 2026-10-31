"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useKarteRevalidation } from "../lib/revalidate";
import { uniqueKartes } from "../lib/uniqueKartes";
import type { KartePage } from "../types";

export function useRecentKarte(enabled: boolean) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<KartePage>(enabled ? "/api/karte/recent" : null);
  useKarteRevalidation(mutate);

  return {
    kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
