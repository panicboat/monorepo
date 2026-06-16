"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";

export function useDeleteComment(postId: string | null | undefined) {
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!postId || !commentId) return;

      setSubmitting(true);
      try {
        await authFetch(
          `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
          { method: "DELETE" }
        );
        mutate(
          (key) =>
            typeof key === "string" &&
            key.startsWith(`/api/posts/${encodeURIComponent(postId)}/comments`)
        );
        mutate(`/api/posts/${encodeURIComponent(postId)}`);
      } finally {
        setSubmitting(false);
      }
    },
    [postId, mutate]
  );

  return { deleteComment, submitting };
}
