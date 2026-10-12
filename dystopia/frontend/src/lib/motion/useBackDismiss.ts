"use client";

import { useEffect, useId, useRef } from "react";

export function useBackDismiss({ open, onDismiss, enabled }: { open: boolean; onDismiss: () => void; enabled: boolean }) {
  const id = useId();
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!open || !enabled) return;
    const url = window.location.href;
    window.history.pushState({ ...window.history.state, dystopiaSheet: id }, "", url);
    let popped = false;
    const pop = () => {
      if (window.history.state?.dystopiaSheet === id && window.location.href === url) return;
      popped = true;
      dismiss.current();
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      if (!popped && window.history.state?.dystopiaSheet === id && window.location.href === url) window.history.back();
    };
  }, [open, enabled, id]);
}
