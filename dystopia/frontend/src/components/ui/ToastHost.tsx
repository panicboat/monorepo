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
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none"
    >
      <button
        type="button"
        onClick={hide}
        className="pointer-events-auto max-w-sm rounded-full bg-text-primary px-4 py-2 text-sm text-bg shadow-lg"
      >
        {message}
      </button>
    </div>
  );
}
