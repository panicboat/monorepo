"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/authStore";
import type { StreamEventPayload } from "../types";

export function MessagingStreamProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!useAuthStore.getState().userId) return;

    // fetch + AbortController rather than EventSource: the browser's
    // EventSource.close() does not synchronously abort the underlying HTTP
    // request. When this provider unmounts (route change away from
    // /messages), a stale server-side gRPC stream was continuing to hold
    // its slot on the frontend Node.js -> monolith HTTP/2 connection,
    // wedging the next unary RPC on the same route (feed, follow, ...) —
    // reproducible in puppet as a permanent-loading spinner. Aborting the
    // fetch propagates through req.signal so the /api/messaging/stream
    // route drops its for-await loop and the backend stream ends.
    const controller = new AbortController();

    const handle = async () => {
      let res: Response;
      try {
        res = await fetch("/api/messaging/stream", { signal: controller.signal });
      } catch {
        // SILENT: aborted before response
        return;
      }
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          for (;;) {
            const boundary = buffer.indexOf("\n\n");
            if (boundary < 0) break;
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            let payload: StreamEventPayload;
            try {
              payload = JSON.parse(dataLine.slice(6)) as StreamEventPayload;
            } catch {
              // SILENT: 不正な payload は読み飛ばす
              continue;
            }
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
          }
        }
      } catch {
        // SILENT: reader aborted
      }
    };

    void handle();

    return () => controller.abort();
  }, [mutate]);

  return <>{children}</>;
}
