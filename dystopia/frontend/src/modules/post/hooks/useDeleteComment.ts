"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { authFetch } from "@/lib/auth";
import { commentsKey } from "./useComments";
import { repliesKey } from "./useReplies";
import { revalidatePostLists } from "../lib/revalidate";

export function useDeleteComment(postId: string | null | undefined) {
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);

  const deleteComment = useCallback(
    async (commentId: string, parentId?: string) => {
      if (!postId || !commentId) return;

      setSubmitting(true);
      try {
        await authFetch(
          `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
          { method: "DELETE" }
        );
        if (parentId) mutate(unstable_serialize(repliesKey(postId, parentId)));
        mutate(unstable_serialize(commentsKey(postId)));
        mutate(`/api/posts/${encodeURIComponent(postId)}`);
        void revalidatePostLists();
      } finally {
        setSubmitting(false);
      }
    },
    [postId, mutate]
  );

  return { deleteComment, submitting };
}
