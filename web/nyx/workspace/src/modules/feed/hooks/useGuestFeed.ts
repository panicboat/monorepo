"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { mapApiToPostsList } from "@/modules/post/lib/mappers";
import type { CastPost } from "@/modules/post/types";
import type { FeedFilter, FeedResult } from "../types";

interface UseGuestFeedOptions {
  initialFilter?: FeedFilter;
}

/**
 * Hook for fetching guest feed from the Feed API.
 * Supports filtering by all, following, or favorites.
 */
export function useGuestFeed(options: UseGuestFeedOptions = {}) {
  const { initialFilter = "all" } = options;

  const [posts, setPosts] = useState<CastPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FeedFilter>(initialFilter);
  const accessToken = useAuthStore((state) => state.accessToken);

  const fetchFeed = useCallback(
    async (cursor?: string, filter?: FeedFilter): Promise<FeedResult> => {
      setLoading(true);
      setError(null);

      const useFilter = filter ?? currentFilter;

      // Update filter if changed (and not a loadMore call)
      if (!cursor && filter && filter !== currentFilter) {
        setCurrentFilter(filter);
      }

      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (useFilter) params.set("filter", useFilter);

        const url = params.toString()
          ? `/api/feed/guest?${params}`
          : "/api/feed/guest";

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(url, {
          cache: "no-store",
          headers,
        });

        if (!res.ok) {
          // FALLBACK: Returns empty object when JSON parse fails
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to fetch feed");
        }

        const data = await res.json();
        const result = mapApiToPostsList(data);

        if (cursor) {
          setPosts((prev) => [...prev, ...result.posts]);
        } else {
          setPosts(result.posts);
        }
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);

        return {
          posts: result.posts,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, currentFilter]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loading) return;
    return fetchFeed(nextCursor, currentFilter);
  }, [fetchFeed, nextCursor, hasMore, loading, currentFilter]);

  const changeFilter = useCallback(
    async (filter: FeedFilter) => {
      setCurrentFilter(filter);
      setPosts([]);
      setNextCursor("");
      setHasMore(false);
      return fetchFeed(undefined, filter);
    },
    [fetchFeed]
  );

  const refresh = useCallback(async () => {
    return fetchFeed(undefined, currentFilter);
  }, [fetchFeed, currentFilter]);

  return {
    posts,
    setPosts,
    loading,
    error,
    hasMore,
    currentFilter,
    fetchFeed,
    loadMore,
    changeFilter,
    refresh,
  };
}
