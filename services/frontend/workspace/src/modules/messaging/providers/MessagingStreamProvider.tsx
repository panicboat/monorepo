"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/authStore";
import type { StreamEventPayload } from "../types";

export function MessagingStreamProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!useAuthStore.getState().userId) return;
    const es = new EventSource("/api/messaging/stream");
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as StreamEventPayload;
        if (payload.type === "message") {
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/messaging/threads/${payload.data.threadId}/messages`)
          );
          mutate("/api/messaging/threads");
          mutate("/api/messaging/unread-count");
        } else if (payload.type === "read_state") {
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/messaging/threads/${payload.data.threadId}/messages`)
          );
          mutate("/api/messaging/threads");
        } else if (payload.type === "typing") {
          window.dispatchEvent(new CustomEvent("messaging:typing", { detail: payload }));
        }
      } catch {
        // SILENT: 不正な payload は読み飛ばす
      }
    };
    return () => es.close();
  }, [mutate]);

  return <>{children}</>;
}
