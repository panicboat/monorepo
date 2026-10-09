"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PostView } from "@/modules/post/lib/post-view";

interface PostResponse {
  post: PostView;
}

export function usePost(id: string | null) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId);
  const { data, error, isLoading, mutate } = useSWR<PostResponse>(
    activeProfileId && id ? `/api/posts/${encodeURIComponent(id)}` : null,
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
