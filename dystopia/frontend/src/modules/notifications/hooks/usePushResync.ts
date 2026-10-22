"use client";

import { useEffect } from "react";
import { resyncPushSubscription } from "@/modules/notifications/lib/push";

export function usePushResync(accountId: string | null) {
  useEffect(() => {
    if (accountId) void resyncPushSubscription();
  }, [accountId]);
}
