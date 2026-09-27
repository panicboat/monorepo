"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/authStore";

const POLL_INTERVAL_MS = 6_000;

// Poll instead of SSE because aborted gRPC streams can block later unary RPCs.
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
