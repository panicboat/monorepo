"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import type { PaginatedAuthorPostsResponse } from "@/modules/post/lib/author-tab-view";

export function useAuthorLikedPosts(profileId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh } = useCursorPages<PaginatedAuthorPostsResponse>(profileId ? `/api/posts/liked-by?profile_id=${encodeURIComponent(profileId)}` : null);
  return {
    posts: pages.flatMap((p) => p.posts || []),
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}
