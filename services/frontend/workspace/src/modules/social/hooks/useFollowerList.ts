"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowerList(accountId?: string) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const accountQs = accountId ? `account_id=${encodeURIComponent(accountId)}` : "";
    const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const sep = accountQs && cursorQs ? "&" : "";
    const qs = (accountQs || cursorQs) ? `?${accountQs}${sep}${cursorQs}` : "";
    return `/api/social/followers${qs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
