"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface TypingDetail {
  type: "typing";
  data: { threadId: string; accountId: string };
}

export function useTyping(threadId: string | null | undefined) {
  const [typingActorId, setTypingActorId] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent<TypingDetail>).detail;
      if (detail?.data?.threadId !== threadId) return;
      setTypingActorId(detail.data.accountId);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTypingActorId(null), 3000);
    };
    window.addEventListener("messaging:typing", onTyping as EventListener);
    return () => {
      window.removeEventListener("messaging:typing", onTyping as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [threadId]);

  const sendTyping = useCallback(async () => {
    if (!threadId || !getAuthToken()) return;
    try {
      await authFetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/typing`, {
        method: "POST",
      });
    } catch {
      // SILENT: typing 通知失敗は UI に影響させない
    }
  }, [threadId]);

  return { typingActorId, sendTyping };
}
