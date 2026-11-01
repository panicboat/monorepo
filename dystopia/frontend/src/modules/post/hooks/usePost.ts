"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
import { usePostQuoteCountStore } from "@/stores/postQuoteCountStore";
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
  const setQuoteCount = usePostQuoteCountStore((s) => s.setCount);
  const fetched = data?.post;

  useEffect(() => {
    if (!fetched) return;
    setCommentCount(fetched.id, fetched.commentsCount);
    setQuoteCount(fetched.id, fetched.quotesCount);
  }, [fetched, setCommentCount, setQuoteCount]);

  return {
    post: data?.post ?? null,
    loading: isLoading,
    error,
    mutate,
  };
}
