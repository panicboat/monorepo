"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/authStore";
import { MESSAGING_POLL_INTERVAL_MS } from "../lib/polling";

export function MessagingPollingProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!useAuthStore.getState().activeProfileId) return;
    const tick = () => {
      mutate("/api/messaging/unread-count");
      mutate("/api/messaging/threads");
    };
    tick();
    const handle = setInterval(tick, MESSAGING_POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [mutate]);

  return <>{children}</>;
}
