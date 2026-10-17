"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useKarteRevalidation } from "../lib/revalidate";
import { uniqueKartes } from "../lib/uniqueKartes";
import type { KarteCounts, MyKartePage } from "../types";

const NO_COUNTS: KarteCounts = { total: 0, open: 0, closed: 0 };

export function useMyKarte() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const role = useAuthStore(selectRole);

  const getKey = (pageIndex: number, prev: MyKartePage | null): string | null => {
    if (!profileId || role !== "cast") return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/my${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<MyKartePage>(getKey, fetcher, { revalidateOnFocus: false });
  useKarteRevalidation(mutate);

  const pages = data || [];
  return {
    kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),
    counts: pages[0]?.counts ?? NO_COUNTS,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
