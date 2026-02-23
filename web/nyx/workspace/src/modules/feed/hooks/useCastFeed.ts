"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { mapApiToPostsList } from "@/modules/post/lib/mappers";
import type { CastPost } from "@/modules/post/types";
import type { FeedResult, FeedAuthor } from "../types";

interface UseCastFeedOptions {
  castId: string;
}

/**
 * Hook for fetching a cast's feed from the Feed API.
 * Used on cast profile pages.
 */
export function useCastFeed(options: UseCastFeedOptions) {
  const { castId } = options;

  const [posts, setPosts] = useState<CastPost[]>([]);
  const [author, setAuthor] = useState<FeedAuthor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);

  const fetchFeed = useCallback(
    async (cursor?: string): Promise<FeedResult> => {
      // FALLBACK: Returns empty state when castId is not provided
      if (!castId) {
        setPosts([]);
        return { posts: [], nextCursor: "", hasMore: false };
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("cast_id", castId);
        if (cursor) params.set("cursor", cursor);

        const url = `/api/feed/cast?${params}`;

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(url, {
          cache: "no-store",
          headers,
        });

        if (!res.ok) {
          // FALLBACK: Returns empty state on 404 status
          if (res.status === 404) {
            setPosts([]);
            return { posts: [], nextCursor: "", hasMore: false };
          }
          // FALLBACK: Returns empty object when JSON parse fails
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to fetch feed");
        }

        const data = await res.json();
        const result = mapApiToPostsList(data);

        // Set author if available
        if (data.author) {
          setAuthor({
            // FALLBACK: Returns empty string for missing author fields
            id: data.author.id || "",
            name: data.author.name || "",
            imageUrl: data.author.imageUrl || "",
          });
        }

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
    [castId, accessToken]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loading) return;
    return fetchFeed(nextCursor);
  }, [fetchFeed, nextCursor, hasMore, loading]);

  const refresh = useCallback(async () => {
    return fetchFeed();
  }, [fetchFeed]);

  return {
    posts,
    author,
    loading,
    error,
    hasMore,
    fetchFeed,
    loadMore,
    refresh,
  };
}
