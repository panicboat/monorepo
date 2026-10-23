"use client";

import { useCallback, useEffect, useState } from "react";
import {
  detectPushSupport,
  disablePush,
  enablePush,
  fetchVapidPublicKey,
  isSubscribedHere,
  readPushEnvironment,
} from "@/modules/notifications/lib/push";
import { useAuthStore } from "@/stores/authStore";

export type PushDeviceState = "loading" | "unsupported" | "needs-install" | "denied" | "unconfigured" | "off" | "on";

const ENABLE_RESULT_STATE = { subscribed: "on", denied: "denied", dismissed: "off" } as const;

export function usePushDevice() {
  const [state, setState] = useState<PushDeviceState>("loading");
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const activeProfileId = useAuthStore((s) => s.activeProfileId);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setFailed(false);
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
        const subscribed = await isSubscribedHere();
        if (!cancelled) setState(subscribed ? "on" : "off");
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
  }, [activeProfileId]);

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
