"use client";

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check if the auth store has been hydrated from localStorage.
 * Use this to prevent hydration mismatches and ensure auth state is ready.
 *
 * @returns boolean indicating if hydration is complete
 *
 * @example
 * const isHydrated = useHydrated();
 * if (!isHydrated) return <Loading />;
 */
export function useHydrated(): boolean {
  return useAuthStore((state) => state.isHydrated);
}

/**
 * Execute a callback after hydration is complete.
 * Useful for fetching data that requires auth state.
 *
 * @param callback - Function to execute after hydration
 * @param deps - Additional dependencies for the effect
 *
 * @example
 * useOnHydrated(() => {
 *   fetchUserData();
 * });
 */
export function useOnHydrated(
  callback: () => void | Promise<void>,
  deps: React.DependencyList = []
) {
  const isHydrated = useHydrated();
  const memoizedCallback = useCallback(callback, deps);

  useEffect(() => {
    if (isHydrated) {
      memoizedCallback();
    }
  }, [isHydrated, memoizedCallback]);
}
