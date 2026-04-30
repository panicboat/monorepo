"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function GuestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Guest error:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
