"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedFootprintsResponse } from "../types";

export function useFootprints() {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (
    pageIndex: number,
    prev: PaginatedFootprintsResponse | null
  ): string | null => {
    if (!userId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs =
      pageIndex === 0
        ? ""
        : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/footprints/list${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedFootprintsResponse>(getKey, fetcher, {
      revalidateOnFocus: false,
    });

  const pages = data || [];
  const footprints = pages.flatMap((p) => p.footprints || []);
  const hasMore =
    pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    footprints,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
