"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { usePostListRevalidation } from "@/modules/post/lib/revalidate";
import type { PaginatedAuthorPostsResponse } from "@/modules/post/lib/author-tab-view";

export function useQuotes(postId: string) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<PaginatedAuthorPostsResponse>(
    `/api/posts/${encodeURIComponent(postId)}/quotes`
  );
  usePostListRevalidation(mutate);

  return {
    posts: pages.flatMap((p) => p.posts || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
