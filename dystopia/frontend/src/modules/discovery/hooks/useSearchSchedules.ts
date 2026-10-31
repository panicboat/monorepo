"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedSchedulesResponse, ScheduleSearchFilters } from "../types";

const DEBOUNCE_MS = 300;

export function useSearchSchedules({ date, prefecture, area, industry, timeBand, followingOnly, query }: ScheduleSearchFilters) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const name = debounced.trim();

  const params = new URLSearchParams({ date });
  if (prefecture) params.set("prefecture", prefecture);
  if (area) params.set("area", area);
  if (industry) params.set("industry", industry);
  if (timeBand) params.set("timeBand", timeBand);
  if (followingOnly) params.set("followingOnly", "true");
  if (name) params.set("q", name);

  const { pages, hasMore, loading, error, loadMore, size, setSize } = useCursorPages<PaginatedSchedulesResponse>(`/api/discovery/schedules?${params}`);

  const filterKey = JSON.stringify([date, prefecture, area, industry, timeBand, followingOnly, name]);
  const lastFilterKey = useRef(filterKey);
  // swr/infinite keeps the page count per key, so a filter set seen before would come back with its old pages.
  useLayoutEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    if (size > 1) setSize(1);
  }, [filterKey, size, setSize]);

  return {
    results: pages.flatMap((p) => p.results || []),
    hasMore,
    loading,
    error,
    loadMore,
  };
}
