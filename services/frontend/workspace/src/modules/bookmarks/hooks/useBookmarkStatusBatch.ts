"use client";

import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { BookmarkStatusMap } from "../types";

interface Response { bookmarked: BookmarkStatusMap }

export function useBookmarkStatusBatch(postIds: string[]) {
  const [bookmarked, setBookmarked] = useState<BookmarkStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = postIds.join(",");

  useEffect(() => {
    if (!getAuthToken() || postIds.length === 0) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await authFetch<Response>(
          "/api/bookmarks/status",
          { method: "POST", body: { postIds } }
        );
        if (cancelled) return;
        setBookmarked(res.bookmarked || {});
      } catch (e) {
        console.error("useBookmarkStatusBatch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isBookmarked = (id: string): boolean => bookmarked[id] ?? false;

  return { bookmarked, isBookmarked, loading };
}
