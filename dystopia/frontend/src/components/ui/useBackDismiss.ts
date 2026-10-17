"use client";

import { useEffect, useRef } from "react";

const STATE_KEY = "sideSheet";

let lastEntry = 0;

function currentEntry(): unknown {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null ? (state as Record<string, unknown>)[STATE_KEY] : undefined;
}

export function useBackDismiss(open: boolean, onDismiss: () => void): void {
  const entry = useRef<number | null>(null);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) {
      // Go back only while the entry is still current: after a navigation replaced it, going back would undo that navigation.
      if (entry.current !== null && currentEntry() === entry.current) window.history.back();
      entry.current = null;
      return;
    }
    // Keep the entry across an effect re-run: pushing again would leave a second entry behind the sheet.
    if (entry.current === null) {
      entry.current = ++lastEntry;
      window.history.pushState({ [STATE_KEY]: entry.current }, "");
    }
    const onPopState = () => {
      entry.current = null;
      dismiss.current();
    };
    window.addEventListener("popstate", onPopState);
    // Leave the history alone on cleanup: going back here would close the sheet when StrictMode re-runs the effect.
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);
}
