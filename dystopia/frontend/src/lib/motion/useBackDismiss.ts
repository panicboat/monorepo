"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";

export function useBackDismiss({ open, onDismiss, enabled }: { open: boolean; onDismiss: () => void; enabled: boolean }) {
  const id = useId();
  const dismiss = useRef(onDismiss);
  const visible = useRef(open);
  const subscribed = useRef(false);
  useLayoutEffect(() => { visible.current = open; }, [open]);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!open || !enabled) return;
    const url = window.location.href;
    subscribed.current = true;
    if (window.history.state?.dystopiaSheet !== id) window.history.pushState({ ...window.history.state, dystopiaSheet: id }, "", url);
    let popped = false;
    const pop = () => {
      if (window.history.state?.dystopiaSheet === id && window.location.href === url) return;
      popped = true;
      dismiss.current();
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      subscribed.current = false;
      if (!popped && window.history.state?.dystopiaSheet === id && window.location.href === url) {
        if (!visible.current) window.history.back();
        // Cache disposal can precede router.replace, so unmount cleanup must not initiate navigation.
        else queueMicrotask(() => {
          if (subscribed.current || window.history.state?.dystopiaSheet !== id || window.location.href !== url) return;
          const state = { ...window.history.state }; delete state.dystopiaSheet;
          window.history.replaceState(state, "", url);
        });
      }
    };
  }, [open, enabled, id]);
}
