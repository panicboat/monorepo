"use client";

import useSWRInfinite, { type SWRInfiniteConfiguration } from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";

export interface CursorPage {
  hasMore?: boolean;
  nextCursor?: string;
}

export const cursorKey =
  (url: string) =>
  (pageIndex: number, prev: CursorPage | null): string | null => {
    if (prev && !prev.hasMore) return null;
    if (pageIndex === 0) return url;
    return `${url}${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
  };

export function useCursorPages<Page extends CursorPage>(url: string | null, config: SWRInfiniteConfiguration<Page> = {}) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<Page>(
    (pageIndex, prev) => (profileId && url ? cursorKey(url)(pageIndex, prev) : null),
    fetcher,
    { revalidateOnFocus: false, ...config }
  );
  const pages = data || [];

  return {
    pages,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    isLoading,
    isValidating,
    loading: isLoading || isValidating,
    error,
    size,
    setSize,
    mutate,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
