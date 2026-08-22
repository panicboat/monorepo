"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <p className="text-text-primary">エラーが発生しました</p>
      <button
        onClick={reset}
        className="rounded-full border border-accent px-4 py-2 text-accent"
      >
        再試行
      </button>
    </div>
  );
}
