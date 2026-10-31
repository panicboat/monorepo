"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useKarteRevalidation } from "../lib/revalidate";
import { uniqueKartes } from "../lib/uniqueKartes";
import type { KarteCounts, MyKartePage } from "../types";

const NO_COUNTS: KarteCounts = { total: 0, unrated: 0 };

export function useMyKarte() {
  const role = useAuthStore(selectRole);
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<MyKartePage>(role === "cast" ? "/api/karte/my" : null);
  useKarteRevalidation(mutate);

  return {
    kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),
    counts: pages[0]?.counts ?? NO_COUNTS,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
