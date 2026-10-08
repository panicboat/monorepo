"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

interface TypingDetail {
  type: "typing";
  data: { threadId: string; profileId: string };
}

export function useTyping(threadId: string | null | undefined) {
  const [typingActorId, setTypingActorId] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent<TypingDetail>).detail;
      if (detail?.data?.threadId !== threadId) return;
      setTypingActorId(detail.data.profileId);
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
    if (!threadId || !useAuthStore.getState().activeProfileId) return;
    try {
      await authFetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/typing`, {
        method: "POST",
      });
    } catch {
      // SILENT: Typing notification failures must not affect the UI.
    }
  }, [threadId]);

  return { typingActorId, sendTyping };
}
