"use client";

import { useState, useCallback, useRef } from "react";
import { AppError } from "@/lib/errors";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UsePaginatedFetchOptions<T, R> {
  apiUrl: string;
  mapResponse: (data: R) => PaginatedResult<T>;
  getItemId: (item: T) => string;
  buildParams?: (params: URLSearchParams) => void;
  fetchFn: (url: string) => Promise<R>;
}

export interface UsePaginatedFetchReturn<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  loadingMore: boolean;
  error: AppError | null;
  hasMore: boolean;
  initialized: boolean;
  fetchInitial: () => Promise<T[] | undefined>;
  fetchMore: () => Promise<T[] | undefined>;
  reset: () => void;
}

export function usePaginatedFetch<T, R = unknown>(
  options: UsePaginatedFetchOptions<T, R>
): UsePaginatedFetchReturn<T> {
  const { apiUrl, mapResponse, getItemId, buildParams, fetchFn } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const initializedRef = useRef(false);
  const hasMoreRef = useRef(true);
  // Keep fetch guards in refs so callback dependencies do not trigger fetch loops.

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (buildParams) buildParams(params);
      return params.toString() ? `${apiUrl}?${params}` : apiUrl;
    },
    [apiUrl, buildParams]
  );

  const fetchInitial = useCallback(async () => {
    if (initializedRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const url = buildUrl();
      const data = await fetchFn(url);
      const result = mapResponse(data);

      setItems(result.items);
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor;
      initializedRef.current = true;
      setInitialized(true);
      return result.items;
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError("UNKNOWN", "予期しないエラーが発生しました", undefined, e);
      setError(err);
      throw err;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [buildUrl, fetchFn, mapResponse]);

  const fetchMore = useCallback(async () => {
    if (!initializedRef.current || !hasMoreRef.current || loadingMoreRef.current || !cursorRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const url = buildUrl(cursorRef.current);
      const data = await fetchFn(url);
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
      const err = e instanceof AppError ? e : new AppError("UNKNOWN", "予期しないエラーが発生しました", undefined, e);
      setError(err);
      throw err;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildUrl, fetchFn, mapResponse, getItemId]);

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
