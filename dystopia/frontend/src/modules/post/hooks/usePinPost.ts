"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth";
import { usePostPinStore } from "@/stores/postPinStore";
import type { PostView } from "@/modules/post/lib/post-view";
import { revalidatePostLists } from "../lib/revalidate";

export function usePinPost(post: PostView) {
  const { id, authorProfileId } = post;
  const pinned = usePostPinStore((s) => {
    const latest = s.pinnedPostIdByAuthor[authorProfileId];
    return latest === undefined ? post.pinned : latest === id;
  });
  const setPinned = usePostPinStore((s) => s.setPinned);
  const [submitting, setSubmitting] = useState(false);

  const togglePin = useCallback(async () => {
    setSubmitting(true);
    try {
      await authFetch(`/api/posts/${encodeURIComponent(id)}/pin`, { method: pinned ? "DELETE" : "POST" });
      setPinned(authorProfileId, pinned ? null : id);
      void revalidatePostLists();
    } finally {
      setSubmitting(false);
    }
  }, [id, authorProfileId, pinned, setPinned]);

  return { pinned, togglePin, submitting };
}
