"use client";

import { useToastStore } from "@/stores/toastStore";

export function ToastHost() {
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6"
    >
      <button
        type="button"
        onClick={hide}
        className="pointer-events-auto max-w-sm rounded-xl border border-accent bg-bg-elevated px-[18px] py-3 text-center text-sm text-text-primary shadow-lg"
      >
        {message}
      </button>
    </div>
  );
}
