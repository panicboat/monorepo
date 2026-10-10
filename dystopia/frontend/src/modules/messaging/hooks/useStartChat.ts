"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth";
import type { ThreadView } from "../types";

interface GetOrCreateThreadResponse {
  thread: ThreadView | null;
}

export function useStartChat() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = useCallback(
    async (targetProfileId: string) => {
      setLoading(true);
      try {
        const res = await authFetch<GetOrCreateThreadResponse>("/api/messaging/threads", {
          method: "POST",
          body: { recipientProfileId: targetProfileId },
        });
        if (!res.thread?.id) throw new Error("メッセージスレッドの作成に失敗しました");
        router.push(`/messages/${encodeURIComponent(res.thread.id)}`);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  return { start, loading };
}
