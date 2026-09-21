"use client";

import { useCallback, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { usePaginatedFetch, type PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import { usePostFeedStore } from "@/stores/postFeedStore";
import type { PostView } from "@/modules/post/lib/post-view";
import type { FeedFilterValue, FeedListView, UseFeedOptions } from "@/modules/feed/types";

export function useFeed(options: UseFeedOptions = {}) {
  const { filter = "all", prefecture } = options;

  const mapResponse = useCallback(
    (data: FeedListView): PaginatedResult<PostView> => ({
      items: data.posts,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor,
    }),
    []
  );

  const getItemId = useCallback((p: PostView) => p.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<FeedListView> =>
      authFetch<FeedListView>(url, { cache: "no-store" }),
    []
  );

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      params.set("filter", filter);
      if (prefecture) params.set("prefecture", prefecture);
    },
    [filter, prefecture]
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
  } = usePaginatedFetch<PostView, FeedListView>({
    apiUrl: "/api/feed",
    mapResponse,
    getItemId,
    fetchFn,
    buildParams,
  });

  // Not SWR-backed, so a post created elsewhere (ComposerFAB) needs this signal to refetch.
  const postCreatedVersion = usePostFeedStore((s) => s.version);
  const lastSeenVersionRef = useRef(postCreatedVersion);
  useEffect(() => {
    if (lastSeenVersionRef.current === postCreatedVersion) return;
    lastSeenVersionRef.current = postCreatedVersion;
    reset();
    fetchInitial();
  }, [postCreatedVersion, reset, fetchInitial]);

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
    filter,
    prefecture,
  };
}

export type { FeedFilterValue, UseFeedOptions };
