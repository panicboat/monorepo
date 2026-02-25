"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CastPost } from "@/modules/post/types";
import { mapApiToPost, mapApiToPostsList } from "@/modules/post/lib/mappers";
import { useAuthStore } from "@/stores/authStore";
import { usePaginatedFetch, PaginatedResult } from "@/lib/hooks/usePaginatedFetch";

type TimelineResponse = Parameters<typeof mapApiToPostsList>[0];

interface UseTimelineOptions {
  castId?: string;
  filter?: string;
}

export function useTimeline(options: UseTimelineOptions = {}) {
  const { castId, filter } = options;
  const accessToken = useAuthStore((state) => state.accessToken);
  const prevFilterRef = useRef(filter);

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      if (castId) params.set("cast_id", castId);
      if (filter) params.set("filter", filter);
    },
    [castId, filter]
  );

  const mapResponse = useCallback(
    (data: TimelineResponse): PaginatedResult<CastPost> => {
      const result = mapApiToPostsList(data);
      return {
        items: result.items,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor || null,
      };
    },
    []
  );

  const getItemId = useCallback((post: CastPost) => post.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<TimelineResponse> => {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(url, { cache: "no-store", headers });
      if (!res.ok) {
        // FALLBACK: Returns empty object when JSON parse fails
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to fetch posts");
      }
      return res.json();
    },
    [accessToken]
  );

  const {
    items: posts,
    setItems: setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = usePaginatedFetch<CastPost, TimelineResponse>({
    apiUrl: "/api/guest/timeline",
    mapResponse,
    getItemId,
    buildParams,
    fetchFn,
  });

  // Auto reset & refetch when filter changes
  useEffect(() => {
    if (prevFilterRef.current !== filter) {
      prevFilterRef.current = filter;
      reset();
      fetchInitial();
    }
  }, [filter, reset, fetchInitial]);

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
    initialized,
  };
}

export function useGuestPost(postId: string | null) {
  const [post, setPost] = useState<CastPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setPost(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch(`/api/guest/timeline/${postId}`, {
        cache: "no-store",
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) {
          setPost(null);
          return null;
        }
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to fetch post");
      }

      const data = await res.json();
      const mappedPost = mapApiToPost(data.post);
      setPost(mappedPost);
      return mappedPost;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [postId, accessToken]);

  return {
    post,
    loading,
    error,
    fetchPost,
  };
}
