"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedKarteByTargetResponse } from "../types";

export function useGuestKarte(targetAccountId: string | null | undefined) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedKarteByTargetResponse | null): string | null => {
    if (!userId || !targetAccountId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/karte/by-target?account_id=${encodeURIComponent(targetAccountId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedKarteByTargetResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;
  const aggregate = pages[0]?.aggregate ?? { count: 0, avgRating: 0 };

  return {
    entries,
    aggregate,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
