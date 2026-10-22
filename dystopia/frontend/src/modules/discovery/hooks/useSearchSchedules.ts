"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedSchedulesResponse, ScheduleSearchFilters } from "../types";

const DEBOUNCE_MS = 300;

export function useSearchSchedules({ date, prefecture, area, industry, timeBand, followingOnly, query }: ScheduleSearchFilters) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const name = debounced.trim();

  const getKey = (pageIndex: number, prev: PaginatedSchedulesResponse | null): string | null => {
    if (!profileId) return null;
    if (prev && !prev.hasMore) return null;
    const params = new URLSearchParams({ date });
    if (prefecture) params.set("prefecture", prefecture);
    if (area) params.set("area", area);
    if (industry) params.set("industry", industry);
    if (timeBand) params.set("timeBand", timeBand);
    if (followingOnly) params.set("followingOnly", "true");
    if (name) params.set("q", name);
    if (pageIndex > 0) params.set("cursor", prev?.nextCursor || "");
    return `/api/discovery/schedules?${params}`;
  };

  const { data, error, size, setSize, isLoading, isValidating } =
    useSWRInfinite<PaginatedSchedulesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const filterKey = JSON.stringify([date, prefecture, area, industry, timeBand, followingOnly, name]);
  const lastFilterKey = useRef(filterKey);
  // swr/infinite keeps the page count per key, so a filter set seen before would come back with its old pages.
  useLayoutEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    if (size > 1) setSize(1);
  }, [filterKey, size, setSize]);

  const pages = data || [];
  const results = pages.flatMap((p) => p.results || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    results,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
  };
}
