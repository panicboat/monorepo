"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { usePostDeletionStore } from "@/stores/postDeletionStore";
import { revalidatePostLists } from "../lib/revalidate";

export function useDeletePost() {
  const { mutate } = useSWRConfig();
  const markDeleted = usePostDeletionStore((s) => s.markDeleted);
  const [submitting, setSubmitting] = useState(false);

  const deletePost = useCallback(
    async (postId: string) => {
      setSubmitting(true);
      try {
        await authFetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
        markDeleted(postId);
        mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
        void revalidatePostLists();
      } finally {
        setSubmitting(false);
      }
    },
    [mutate, markDeleted]
  );

  return { deletePost, submitting };
}
