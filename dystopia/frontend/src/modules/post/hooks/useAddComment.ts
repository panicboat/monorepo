"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { authFetch } from "@/lib/auth";
import { commentsKey } from "./useComments";
import { repliesKey } from "./useReplies";
import { revalidatePostLists } from "../lib/revalidate";

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
        if (parentId) mutate(unstable_serialize(repliesKey(postId, parentId)));
        mutate(unstable_serialize(commentsKey(postId)));
        mutate(`/api/posts/${encodeURIComponent(postId)}`);
        void revalidatePostLists();
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
