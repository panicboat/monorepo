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

  // Use refs to track state without triggering re-renders of callbacks
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const initializedRef = useRef(false);
  const hasMoreRef = useRef(true);

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
    // Use refs to check state without dependency issues
    if (initializedRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    try {
      const url = buildUrl();
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch casts");
      }
      const data: SearchResponse = await res.json();
      setCasts(data.items);
      hasMoreRef.current = data.hasMore;
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      initializedRef.current = true;
      setInitialized(true);
      return data;
    } catch (e) {
      console.error("Fetch casts error:", e);
      throw e;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [buildUrl]);

  const fetchMore = useCallback(async () => {
    if (!initializedRef.current || !hasMoreRef.current || loadingMoreRef.current || !cursorRef.current) {
      return;
    }

    loadingMoreRef.current = true;
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
      hasMoreRef.current = data.hasMore;
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      return data;
    } catch (e) {
      console.error("Fetch more casts error:", e);
      throw e;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildUrl]);

  const reset = useCallback(() => {
    setCasts([]);
    hasMoreRef.current = true;
    setHasMore(true);
    cursorRef.current = null;
    initializedRef.current = false;
    loadingRef.current = false;
    loadingMoreRef.current = false;
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
