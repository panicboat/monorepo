"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedAuthorPostsResponse } from "@/modules/post/lib/author-tab-view";

export function useAuthorPosts(profileId: string | null | undefined, mediaOnly: boolean) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: PaginatedAuthorPostsResponse | null): string | null => {
    if (!activeProfileId || !profileId) return null;
    if (prev && !prev.hasMore) return null;
    const params = new URLSearchParams();
    params.set("author_profile_id", profileId);
    if (mediaOnly) params.set("media_only", "1");
    if (pageIndex > 0 && prev?.nextCursor) params.set("cursor", prev.nextCursor);
    return `/api/posts?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedAuthorPostsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const posts = pages.flatMap((p) => p.posts || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    posts,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
