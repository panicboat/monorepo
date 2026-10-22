"use client";

import { useCallback, useEffect, useState } from "react";
import {
  currentPushSubscription,
  detectPushSupport,
  disablePush,
  enablePush,
  fetchVapidPublicKey,
  readPushEnvironment,
} from "@/modules/notifications/lib/push";

export type PushDeviceState = "loading" | "unsupported" | "needs-install" | "denied" | "unconfigured" | "off" | "on";

const ENABLE_RESULT_STATE = { subscribed: "on", denied: "denied", dismissed: "off" } as const;

export function usePushDevice() {
  const [state, setState] = useState<PushDeviceState>("loading");
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const support = detectPushSupport(readPushEnvironment());
      if (support !== "available") {
        if (!cancelled) setState(support);
        return;
      }
      try {
        const key = await fetchVapidPublicKey();
        if (cancelled) return;
        if (!key) {
          setState("unconfigured");
          return;
        }
        setVapidPublicKey(key);
        const subscription = await currentPushSubscription();
        if (!cancelled) setState(subscription ? "on" : "off");
      } catch {
        if (!cancelled) {
          setState("off");
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const change = useCallback(async (action: () => Promise<PushDeviceState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await action());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(
    () => change(async () => ENABLE_RESULT_STATE[await enablePush(vapidPublicKey)]),
    [change, vapidPublicKey]
  );
  const disable = useCallback(
    () =>
      change(async () => {
        await disablePush();
        return "off";
      }),
    [change]
  );

  return { state, busy, failed, enable, disable };
}
