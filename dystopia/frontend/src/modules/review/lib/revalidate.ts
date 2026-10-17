"use client";

import { useEffect } from "react";

// SWR's matcher mutate skips useSWRInfinite keys, so each review hook registers its own refresh here instead.
const refreshers = new Set<() => unknown>();

export function revalidateReview(): Promise<unknown[]> {
  return Promise.all([...refreshers].map((refresh) => refresh()));
}

export function useReviewRevalidation(refresh: () => unknown): void {
  useEffect(() => {
    refreshers.add(refresh);
    return () => {
      refreshers.delete(refresh);
    };
  }, [refresh]);
}
