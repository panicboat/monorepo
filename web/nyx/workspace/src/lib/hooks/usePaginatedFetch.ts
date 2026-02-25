"use client";

import { useState, useCallback, useRef } from "react";
import { getAuthToken } from "@/lib/swr";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UsePaginatedFetchOptions<T, R> {
  /** Base API URL */
  apiUrl: string;
  /** Transform API response to paginated result */
  mapResponse: (data: R) => PaginatedResult<T>;
  /** Get unique identifier from item (for deduplication) */
  getItemId: (item: T) => string;
  /** Whether to include auth token (default: true) */
  authenticated?: boolean;
  /** Additional query params builder */
  buildParams?: (params: URLSearchParams) => void;
  /** Custom fetch function (for authFetch support) */
  fetchFn?: (url: string) => Promise<R>;
}

export interface UsePaginatedFetchReturn<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  initialized: boolean;
  fetchInitial: () => Promise<T[] | undefined>;
  fetchMore: () => Promise<T[] | undefined>;
  reset: () => void;
}

/**
 * Generic hook for cursor-based paginated data fetching.
 * Uses ref-based state tracking to prevent infinite loops in useEffect.
 */
export function usePaginatedFetch<T, R = unknown>(
  options: UsePaginatedFetchOptions<T, R>
): UsePaginatedFetchReturn<T> {
  const { apiUrl, mapResponse, getItemId, authenticated = true, buildParams, fetchFn } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Use refs to track state without triggering re-renders of callbacks
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const initializedRef = useRef(false);
  const hasMoreRef = useRef(true);

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (buildParams) buildParams(params);
      return params.toString() ? `${apiUrl}?${params}` : apiUrl;
    },
    [apiUrl, buildParams]
  );

  const doFetch = useCallback(
    async (url: string): Promise<R> => {
      if (fetchFn) {
        return fetchFn(url);
      }

      const headers: Record<string, string> = {};
      if (authenticated) {
        const token = getAuthToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(url, {
        cache: "no-store",
        headers,
      });

      if (!res.ok) {
        // FALLBACK: Returns empty object when JSON parse fails
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to fetch from ${apiUrl}`);
      }

      return res.json();
    },
    [apiUrl, authenticated, fetchFn]
  );

  const fetchInitial = useCallback(async () => {
    // Use refs to check state without dependency issues
    if (initializedRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const url = buildUrl();
      const data = await doFetch(url);
      const result = mapResponse(data);

      setItems(result.items);
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor;
      initializedRef.current = true;
      setInitialized(true);
      return result.items;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [buildUrl, doFetch, mapResponse]);

  const fetchMore = useCallback(async () => {
    if (!initializedRef.current || !hasMoreRef.current || loadingMoreRef.current || !cursorRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const url = buildUrl(cursorRef.current);
      const data = await doFetch(url);
      const result = mapResponse(data);

      setItems((prev) => {
        const existingIds = new Set(prev.map(getItemId));
        const newItems = result.items.filter((item) => !existingIds.has(getItemId(item)));
        return [...prev, ...newItems];
      });
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor;
      return result.items;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildUrl, doFetch, mapResponse, getItemId]);

  const reset = useCallback(() => {
    setItems([]);
    hasMoreRef.current = true;
    setHasMore(true);
    cursorRef.current = null;
    initializedRef.current = false;
    loadingRef.current = false;
    loadingMoreRef.current = false;
    setInitialized(false);
    setError(null);
  }, []);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  };
}
