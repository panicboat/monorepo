"use client";

import { useCallback, useState, useRef } from "react";

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
  const [casts, setCasts] = useState<CastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
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
      if (cursor) {
        params.set("cursor", cursor);
      }
      return `/api/guest/search?${params.toString()}`;
    },
    [options.genreId, options.tag, options.status, options.query]
  );

  const fetchInitial = useCallback(async () => {
    if (initialized || loading) {
      return;
    }

    setLoading(true);
    try {
      const url = buildUrl();
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch casts");
      }
      const data: SearchResponse = await res.json();
      setCasts(data.items);
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      setInitialized(true);
      return data;
    } catch (e) {
      console.error("Fetch casts error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [buildUrl, initialized, loading]);

  const fetchMore = useCallback(async () => {
    if (!initialized || !hasMore || loadingMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const url = buildUrl(cursorRef.current);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch more casts");
      }
      const data: SearchResponse = await res.json();
      setCasts((prev) => {
        const existingIds = new Set(prev.map((c) => c.profile?.slug));
        const newCasts = data.items.filter(
          (c) => !existingIds.has(c.profile?.slug)
        );
        return [...prev, ...newCasts];
      });
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      return data;
    } catch (e) {
      console.error("Fetch more casts error:", e);
      throw e;
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, initialized, hasMore, loadingMore]);

  const reset = useCallback(() => {
    setCasts([]);
    setHasMore(true);
    cursorRef.current = null;
    setInitialized(false);
  }, []);

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
