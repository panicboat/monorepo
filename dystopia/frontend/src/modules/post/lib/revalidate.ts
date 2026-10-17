"use client";

import { useEffect } from "react";

// SWR's matcher mutate skips useSWRInfinite keys, so each author list hook registers its own refresh here instead.
const refreshers = new Set<() => unknown>();

export function revalidatePostLists(): Promise<unknown[]> {
  return Promise.all([...refreshers].map((refresh) => refresh()));
}

export function usePostListRevalidation(refresh: () => unknown): void {
  useEffect(() => {
    refreshers.add(refresh);
    return () => {
      refreshers.delete(refresh);
    };
  }, [refresh]);
}
