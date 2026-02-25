"use client";

import { useCallback } from "react";
import { CastPost, SavePostMedia } from "@/modules/post/types";
import { mapApiToPost, mapApiToPostsList, mapPostToSavePayload } from "@/modules/post/lib/mappers";
import { authFetch } from "@/lib/auth/fetch";
import { usePaginatedFetch, PaginatedResult } from "@/lib/hooks/usePaginatedFetch";

type CastPostsResponse = Parameters<typeof mapApiToPostsList>[0];

interface UseCastPostsOptions {
  apiPath?: string;
}

export function useCastPosts(options: UseCastPostsOptions = {}) {
  const { apiPath = "/api/cast/timeline" } = options;

  const mapResponse = useCallback(
    (data: CastPostsResponse): PaginatedResult<CastPost> => {
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
    async (url: string): Promise<CastPostsResponse> => {
      return authFetch<CastPostsResponse>(url, { cache: "no-store" });
    },
    []
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
  } = usePaginatedFetch<CastPost, CastPostsResponse>({
    apiUrl: apiPath,
    mapResponse,
    getItemId,
    fetchFn,
  });

  const savePost = useCallback(
    async (post: { id?: string; content: string; media: SavePostMedia[]; visibility?: "public" | "private"; hashtags?: string[] }) => {
      const payload = mapPostToSavePayload(post);

      const data = await authFetch<{ post: Parameters<typeof mapApiToPost>[0] }>(apiPath, {
        method: "PUT",
        body: payload,
      });

      const savedPost = mapApiToPost(data.post);

      if (post.id) {
        setPosts((prev) => prev.map((p) => (p.id === savedPost.id ? savedPost : p)));
      } else {
        setPosts((prev) => [savedPost, ...prev]);
      }

      return savedPost;
    },
    [apiPath, setPosts]
  );

  const toggleVisibility = useCallback(
    async (postId: string, visibility: "public" | "private") => {
      const post = posts.find((p) => p.id === postId);
      if (!post) throw new Error("Post not found");

      const payload = {
        id: post.id,
        content: post.content,
        media: [],
        visibility,
      };

      const data = await authFetch<{ post: Parameters<typeof mapApiToPost>[0] }>(apiPath, {
        method: "PUT",
        body: payload,
      });

      const updatedPost = mapApiToPost(data.post);
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
      return updatedPost;
    },
    [apiPath, posts, setPosts]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      await authFetch(apiPath, {
        method: "DELETE",
        body: { id: postId },
      });

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [apiPath, setPosts]
  );

  const removePostLocally = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [setPosts]
  );

  const restorePostLocally = useCallback(
    (post: CastPost) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        const restored = [...prev, post].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return restored;
      });
    },
    [setPosts]
  );

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
    savePost,
    toggleVisibility,
    deletePost,
    removePostLocally,
    restorePostLocally,
  };
}
