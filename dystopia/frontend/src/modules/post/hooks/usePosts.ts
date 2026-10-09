"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { usePaginatedFetch, type PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import type { PostView, PostsListView, SavePostPayload } from "@/modules/post/lib/post-view";

interface UsePostsOptions {
  authorProfileId?: string;
  filter?: string;
}

interface SavePostResponse {
  post: PostView;
}

export function usePosts(options: UsePostsOptions = {}) {
  const { authorProfileId, filter } = options;

  const mapResponse = useCallback(
    (data: PostsListView): PaginatedResult<PostView> => ({
      items: data.posts,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor,
    }),
    []
  );

  const getItemId = useCallback((p: PostView) => p.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<PostsListView> =>
      authFetch<PostsListView>(url, { cache: "no-store" }),
    []
  );

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      if (authorProfileId) params.set("author_profile_id", authorProfileId);
      if (filter) params.set("filter", filter);
    },
    [authorProfileId, filter]
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
  } = usePaginatedFetch<PostView, PostsListView>({
    apiUrl: "/api/posts",
    mapResponse,
    getItemId,
    fetchFn,
    buildParams,
  });

  const createPost = useCallback(
    async (payload: SavePostPayload) => {
      const data = await authFetch<SavePostResponse>("/api/posts", {
        method: "POST",
        body: payload,
      });
      setPosts((prev) => [data.post, ...prev]);
      return data.post;
    },
    [setPosts]
  );

  const updatePost = useCallback(
    async (id: string, payload: SavePostPayload) => {
      const data = await authFetch<SavePostResponse>(`/api/posts/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: payload,
      });
      setPosts((prev) => prev.map((p) => (p.id === data.post.id ? data.post : p)));
      return data.post;
    },
    [setPosts]
  );

  const deletePost = useCallback(
    async (id: string) => {
      await authFetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
    },
    [setPosts]
  );

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
    createPost,
    updatePost,
    deletePost,
  };
}
