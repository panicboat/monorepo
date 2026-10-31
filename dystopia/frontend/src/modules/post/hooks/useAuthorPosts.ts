"use client";

import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { usePostListRevalidation } from "@/modules/post/lib/revalidate";
import type { PaginatedAuthorPostsResponse } from "@/modules/post/lib/author-tab-view";

export function useAuthorPosts(profileId: string | null | undefined, mediaOnly: boolean) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<PaginatedAuthorPostsResponse>(
    profileId ? `/api/posts?author_profile_id=${encodeURIComponent(profileId)}${mediaOnly ? "&media_only=1" : ""}` : null
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
