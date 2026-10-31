"use client";

import { MESSAGING_POLL_INTERVAL_MS } from "../lib/polling";
import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { authFetch } from "@/lib/auth";
import { useCallback } from "react";
import type { PaginatedMessagesResponse } from "../types";

export function useMessages(threadId: string | null | undefined) {
  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<PaginatedMessagesResponse>(
    threadId ? `/api/messaging/threads/${encodeURIComponent(threadId)}/messages` : null,
    { refreshInterval: MESSAGING_POLL_INTERVAL_MS }
  );

  const send = useCallback(
    async (content: string) => {
      if (!threadId) return;
      await authFetch("/api/messaging/messages", {
        method: "POST",
        body: { threadId, content },
      });
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
    messages: pages.flatMap((p) => p.messages || []),
    hasMore,
    loading,
    error,
    loadMore,
    send,
    markRead,
    refresh,
  };
}
