"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface StatusResponse { bookmarked: Record<string, boolean> }

export function useBookmark(postId: string | null | undefined) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId || !getAuthToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/bookmarks/status",
          { method: "POST", body: { postIds: [postId] } }
        );
        if (cancelled) return;
        setIsBookmarked(!!res.bookmarked?.[postId]);
      } catch (e) {
        console.error("useBookmark fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [postId]);

  const bookmark = useCallback(async () => {
    if (!postId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/bookmarks/${encodeURIComponent(postId)}`, { method: "POST" });
      setIsBookmarked(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const unbookmark = useCallback(async () => {
    if (!postId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/bookmarks/${encodeURIComponent(postId)}`, { method: "DELETE" });
      setIsBookmarked(false);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const toggle = useCallback(async () => {
    if (isBookmarked) return unbookmark();
    return bookmark();
  }, [isBookmarked, bookmark, unbookmark]);

  return { isBookmarked, bookmark, unbookmark, toggle, loading };
}
