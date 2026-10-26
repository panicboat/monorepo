"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useAuthStore } from "@/stores/authStore";
import { MESSAGING_POLL_INTERVAL_MS } from "../lib/polling";
import { threadsKey } from "../hooks/useThreads";

export function MessagingPollingProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!useAuthStore.getState().activeProfileId) return;
    const tick = () => {
      mutate("/api/messaging/unread-count");
      mutate(unstable_serialize(threadsKey));
    };
    tick();
    const handle = setInterval(tick, MESSAGING_POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [mutate]);

  return <>{children}</>;
}
