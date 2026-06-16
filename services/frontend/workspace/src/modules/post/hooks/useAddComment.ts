"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";

export function useAddComment(postId: string | null | undefined) {
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addComment = useCallback(
    async (content: string) => {
      if (!postId) return;
      const trimmed = content.trim();
      if (trimmed.length === 0) return;

      setSubmitting(true);
      setError(null);
      try {
        await authFetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
          method: "POST",
          body: { content: trimmed },
        });
        // Refresh: comment list (useSWRInfinite cache keys start with this path) + post detail (commentsCount)
        mutate(
          (key) =>
            typeof key === "string" &&
            key.startsWith(`/api/posts/${encodeURIComponent(postId)}/comments`)
        );
        mutate(`/api/posts/${encodeURIComponent(postId)}`);
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [postId, mutate]
  );

  return { addComment, submitting, error };
}
