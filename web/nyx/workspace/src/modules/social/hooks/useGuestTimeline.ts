"use client";

import { useState, useCallback } from "react";
import { CastPost } from "@/modules/social/types";
import { mapApiToPost, mapApiToPostsList } from "@/modules/social/lib/mappers";

interface UseGuestTimelineOptions {
  castId?: string;
}

export function useGuestTimeline(options: UseGuestTimelineOptions = {}) {
  const { castId } = options;

  const [posts, setPosts] = useState<CastPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (castId) params.set("cast_id", castId);

        const url = params.toString()
          ? `/api/guest/timeline?${params}`
          : "/api/guest/timeline";

        const res = await fetch(url, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to fetch posts");
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
        return result.posts;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [castId]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore) return;
    return fetchPosts(nextCursor);
  }, [fetchPosts, nextCursor, hasMore]);

  const refresh = useCallback(async () => {
    setNextCursor("");
    return fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchPosts,
    loadMore,
    refresh,
  };
}

export function useGuestPost(postId: string | null) {
  const [post, setPost] = useState<CastPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setPost(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/guest/timeline/${postId}`, {
        cache: "no-store",
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
  }, [postId]);

  return {
    post,
    loading,
    error,
    fetchPost,
  };
}
