"use client";

import { useCallback, useMemo } from "react";
import { usePaginatedFetch, PaginatedResult } from "@/lib/hooks/usePaginatedFetch";

type StatusFilter = "all" | "online" | "new" | "ranking";

type CastProfile = {
  name: string;
  slug: string;
  tagline: string;
  bio: string;
  imageUrl: string;
  avatarUrl: string;
  age?: number;
  areas: { id: string; name: string; prefecture: string; code: string }[];
  genres: { id: string; name: string; slug: string; displayOrder: number }[];
  tags: { label: string; count: number }[];
  isOnline?: boolean;
  isPrivate?: boolean;
};

type CastItem = {
  profile: CastProfile | null;
  plans: { id: string; name: string; price: number; duration: number }[];
};

interface SearchResponse {
  items: CastItem[];
  nextCursor: string;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

interface UseInfiniteCastsOptions {
  genreId?: string;
  tag?: string;
  status?: StatusFilter;
  query?: string;
}

export function useInfiniteCasts(options: UseInfiniteCastsOptions) {
  const buildParams = useCallback(
    (params: URLSearchParams) => {
      params.set("limit", String(PAGE_SIZE));
      if (options.status && options.status !== "all") {
        params.set("status", options.status);
      }
      if (options.genreId) {
        params.set("genreId", options.genreId);
      }
      if (options.query?.trim()) {
        params.set("query", options.query.trim());
      }
      if (options.tag) {
        params.set("tag", options.tag);
      }
    },
    [options.genreId, options.tag, options.status, options.query]
  );

  const mapResponse = useCallback((data: SearchResponse): PaginatedResult<CastItem> => ({
    items: data.items,
    hasMore: data.hasMore,
    nextCursor: data.nextCursor || null,
  }), []);

  const getItemId = useCallback((item: CastItem) => item.profile?.slug || "", []);

  const {
    items: casts,
    loading,
    loadingMore,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = usePaginatedFetch<CastItem, SearchResponse>({
    apiUrl: "/api/guest/search",
    mapResponse,
    getItemId,
    authenticated: false,
    buildParams,
  });

  return {
    casts,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
    initialized,
  };
}
