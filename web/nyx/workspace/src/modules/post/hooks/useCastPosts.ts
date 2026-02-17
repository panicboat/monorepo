"use client";

import { useState, useCallback } from "react";
import { CastPost, PostMedia } from "@/modules/post/types";
import { mapApiToPost, mapApiToPostsList, mapPostToSavePayload } from "@/modules/post/lib/mappers";
import { getAuthToken } from "@/lib/swr";

interface UseCastPostsOptions {
  apiPath?: string;
}

export function useCastPosts(options: UseCastPostsOptions = {}) {
  const { apiPath = "/api/cast/timeline" } = options;

  const [posts, setPosts] = useState<CastPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(async (cursor?: string) => {
    const token = getAuthToken();
    if (!token) {
      setPosts([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);

      const url = params.toString() ? `${apiPath}?${params}` : apiPath;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) {
          setPosts([]);
          return [];
        }
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
  }, [apiPath]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore) return;
    return fetchPosts(nextCursor);
  }, [fetchPosts, nextCursor, hasMore]);

  const savePost = useCallback(
    async (post: { id?: string; content: string; media: PostMedia[]; visibility?: "public" | "private"; hashtags?: string[] }) => {
      const token = getAuthToken();
      if (!token) throw new Error("No token");

      const payload = mapPostToSavePayload(post);

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to save post");
      }

      const data = await res.json();
      const savedPost = mapApiToPost(data.post);

      if (post.id) {
        setPosts((prev) => prev.map((p) => (p.id === savedPost.id ? savedPost : p)));
      } else {
        setPosts((prev) => [savedPost, ...prev]);
      }

      return savedPost;
    },
    [apiPath]
  );

  const toggleVisibility = useCallback(
    async (postId: string, visibility: "public" | "private") => {
      const token = getAuthToken();
      if (!token) throw new Error("No token");

      const post = posts.find((p) => p.id === postId);
      if (!post) throw new Error("Post not found");

      const payload = {
        id: post.id,
        content: post.content,
        media: [],
        visibility,
      };

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to toggle visibility");
      }

      const data = await res.json();
      const updatedPost = mapApiToPost(data.post);
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
      return updatedPost;
    },
    [apiPath, posts]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      const token = getAuthToken();
      if (!token) throw new Error("No token");

      const res = await fetch(apiPath, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: postId }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to delete post");
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [apiPath]
  );

  const removePostLocally = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const restorePostLocally = useCallback((post: CastPost) => {
    setPosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      const restored = [...prev, post].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return restored;
    });
  }, []);

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchPosts,
    loadMore,
    savePost,
    toggleVisibility,
    deletePost,
    removePostLocally,
    restorePostLocally,
  };
}
