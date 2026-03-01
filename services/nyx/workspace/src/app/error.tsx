"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
