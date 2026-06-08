"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PostView } from "@/modules/post/lib/post-view";

interface PostResponse {
  post: PostView;
}

export function usePost(id: string | null) {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PostResponse>(
    token && id ? `/api/posts/${encodeURIComponent(id)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    post: data?.post ?? null,
    loading: isLoading,
    error,
    mutate,
  };
}
