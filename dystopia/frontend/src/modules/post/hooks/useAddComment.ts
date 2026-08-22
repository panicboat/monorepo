"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";

export function useAddComment(postId: string | null | undefined) {
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addComment = useCallback(
    async (content: string, parentId?: string) => {
      if (!postId) return;
      const trimmed = content.trim();
      if (trimmed.length === 0) return;

      setSubmitting(true);
      setError(null);
      try {
        await authFetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
          method: "POST",
          body: { content: trimmed, parentId: parentId || "" },
        });
        if (parentId) {
          // Refresh reply list for this parent + top-level comment row (repliesCount bump).
          const repliesPrefix = `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(parentId)}/replies`;
          mutate(
            (key) => typeof key === "string" && key.startsWith(repliesPrefix)
          );
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/posts/${encodeURIComponent(postId)}/comments`) &&
              !key.includes("/replies")
          );
        } else {
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/posts/${encodeURIComponent(postId)}/comments`)
          );
        }
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
