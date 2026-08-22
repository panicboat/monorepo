"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/authStore";

/**
 * Poll-based refresh for messaging state.
 *
 * Historically this provider held a server-streaming SSE subscription
 * (`/api/messaging/stream`) so the client would push-refresh on incoming
 * messages, reads, and typing signals. In practice the abort path of
 * that stream never propagated cleanly through the Node.js gRPC client
 * on the BFF: puppet reproduced the symptom where opening /messages
 * once left a lingering HTTP/2 stream on the frontend→monolith
 * connection, and every subsequent unary RPC (feed, follow, ...) sat
 * waiting for a response the server never sent — the user's central
 * feed spinner.
 *
 * We drop the SSE and poll a lightweight endpoint every 6 seconds
 * instead. It trades sub-second delivery for guaranteed cleanup on
 * unmount. Typing indicators are gone as a consequence; that feature
 * was best-effort and can come back once we have a working push
 * channel that survives cancellation.
 */
const POLL_INTERVAL_MS = 6_000;

export function MessagingStreamProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!useAuthStore.getState().userId) return;
    const tick = () => {
      mutate("/api/messaging/unread-count");
      mutate("/api/messaging/threads");
    };
    tick();
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [mutate]);

  return <>{children}</>;
}
