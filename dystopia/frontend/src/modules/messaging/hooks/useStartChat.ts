"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth";
import type { ThreadView } from "../types";

interface GetOrCreateThreadResponse {
  thread: ThreadView | null;
}

interface StartChatOptions {
  replace?: boolean;
}

export function useStartChat() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = useCallback(
    async (targetProfileId: string, { replace = false }: StartChatOptions = {}) => {
      setLoading(true);
      try {
        const res = await authFetch<GetOrCreateThreadResponse>("/api/messaging/threads", {
          method: "POST",
          body: { recipientProfileId: targetProfileId },
        });
        if (!res.thread?.id) throw new Error("メッセージスレッドの作成に失敗しました");
        const path = `/messages/${encodeURIComponent(res.thread.id)}`;
        if (replace) router.replace(path);
        else router.push(path);
        return path;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  return { start, loading };
}
