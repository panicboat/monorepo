"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

export function useViewScope(active: boolean, key = "") {
  const accountId = useAuthStore((state) => state.accountId);
  const profileId = useAuthStore((state) => state.activeProfileId);
  const [scope, setScope] = useState({ id: 0, active, key, accountId, profileId });
  if (scope.active !== active || scope.key !== key || scope.accountId !== accountId || scope.profileId !== profileId) setScope({ id: scope.id + 1, active, key, accountId, profileId });
  const mounted = useRef(false);
  const current = useRef(scope);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { current.current = scope; }, [scope]);
  const capture = useCallback(() => {
    const sameActor = () => useAuthStore.getState().accountId === scope.accountId && useAuthStore.getState().activeProfileId === scope.profileId;
    return { isSameActor: sameActor, isMounted: () => mounted.current, isCurrent: () => mounted.current && current.current.active && current.current.id === scope.id && sameActor() };
  }, [scope]);
  return { capture, scopeId: scope.id };
}
