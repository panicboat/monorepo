"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import { authFetch } from "@/lib/auth";
import { useCallback } from "react";
import type { PaginatedMessagesResponse } from "../types";

export function useMessages(threadId: string | null | undefined) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedMessagesResponse | null): string | null => {
    if (!token || !threadId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/messaging/threads/${encodeURIComponent(threadId)}/messages${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedMessagesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const messages = pages.flatMap((p) => p.messages || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  const send = useCallback(
    async (content: string) => {
      if (!threadId) return;
      await authFetch("/api/messaging/messages", {
        method: "POST",
        body: { threadId, content },
      });
      // streaming で event 受信 → SWR mutate されるので明示 refresh 不要だが、保険として
      mutate();
    },
    [threadId, mutate]
  );

  const markRead = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      await authFetch(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/read`,
        { method: "POST", body: { messageId } }
      );
    },
    [threadId]
  );

  return {
    messages,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    send,
    markRead,
    refresh: () => mutate(),
  };
}
