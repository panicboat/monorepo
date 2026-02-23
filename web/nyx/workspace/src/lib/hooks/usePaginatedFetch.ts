"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/swr";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string;
  hasMore: boolean;
}

export interface UsePaginatedFetchOptions<T, R> {
  /** Base API URL */
  apiUrl: string;
  /** Transform API response to paginated result */
  mapResponse: (data: R) => PaginatedResult<T>;
  /** Whether to include auth token (default: true) */
  authenticated?: boolean;
  /** Additional query params builder */
  buildParams?: (params: URLSearchParams) => void;
}

export interface UsePaginatedFetchReturn<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  fetchItems: (cursor?: string) => Promise<T[]>;
  loadMore: () => Promise<T[] | undefined>;
  refresh: () => Promise<T[]>;
}

/**
 * Generic hook for cursor-based paginated data fetching.
 * Reduces boilerplate in timeline/list hooks.
 */
export function usePaginatedFetch<T, R = unknown>(
  options: UsePaginatedFetchOptions<T, R>
): UsePaginatedFetchReturn<T> {
  const { apiUrl, mapResponse, authenticated = true, buildParams } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);

  const fetchItems = useCallback(
    async (cursor?: string): Promise<T[]> => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (buildParams) buildParams(params);

        const url = params.toString() ? `${apiUrl}?${params}` : apiUrl;

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
          // FALLBACK: Returns empty state on 404 status
          if (res.status === 404) {
            setItems([]);
            setNextCursor("");
            setHasMore(false);
            return [];
          }
          // FALLBACK: Returns empty object when JSON parse fails
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Failed to fetch from ${apiUrl}`);
        }

        const data = await res.json();
        const result = mapResponse(data);

        if (cursor) {
          setItems((prev) => [...prev, ...result.items]);
        } else {
          setItems(result.items);
        }
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        return result.items;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, mapResponse, authenticated, buildParams]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore) return;
    return fetchItems(nextCursor);
  }, [fetchItems, nextCursor, hasMore]);

  const refresh = useCallback(async () => {
    setNextCursor("");
    return fetchItems();
  }, [fetchItems]);

  return {
    items,
    setItems,
    loading,
    error,
    hasMore,
    fetchItems,
    loadMore,
    refresh,
  };
}
