"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
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
  const setCommentCount = usePostCommentCountStore((s) => s.setCount);
  const fetched = data?.post;

  useEffect(() => {
    if (fetched) setCommentCount(fetched.id, fetched.commentsCount);
  }, [fetched, setCommentCount]);

  return {
    post: data?.post ?? null,
    loading: isLoading,
    error,
    mutate,
  };
}
