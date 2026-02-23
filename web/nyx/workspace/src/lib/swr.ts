import { SWRConfiguration } from "swr";

import { useAuthStore } from "@/stores/authStore";

/**
 * Get auth token from authStore
 * Use this for all authenticated API calls in hooks.
 */
export function getAuthToken(): string | null {
  // FALLBACK: Returns null during SSR since browser APIs are unavailable
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().accessToken;
}

/**
 * Default fetcher for SWR
 * Automatically includes authorization header if token exists.
 * Uses cache: "no-store" for real-time data.
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  // Import authFetch dynamically to avoid circular dependency
  const { authFetch, ApiError } = await import("@/lib/auth/fetch");

  try {
    return await authFetch<T>(url, {
      method: "GET",
      requireAuth: false, // SWR handles cases where token is optional
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // Re-throw with SWR-compatible format
      const swrError = new Error(error.message);
      (swrError as unknown as { status: number }).status = error.status;
      (swrError as unknown as { info: unknown }).info = error.info;
      throw swrError;
    }
    throw error;
  }
};

/**
 * Authenticated fetcher for SWR
 * Requires authentication, throws if no token available.
 */
export const authFetcher = async <T>(url: string): Promise<T> => {
  const { authFetch, ApiError } = await import("@/lib/auth/fetch");

  try {
    return await authFetch<T>(url, {
      method: "GET",
      requireAuth: true,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const swrError = new Error(error.message);
      (swrError as unknown as { status: number }).status = error.status;
      (swrError as unknown as { info: unknown }).info = error.info;
      throw swrError;
    }
    throw error;
  }
};

/**
 * Default SWR configuration
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false, // Disable auto-revalidation on window focus
  revalidateOnReconnect: true,
  dedupingInterval: 2000, // Dedupe requests within 2 seconds
  errorRetryCount: 3,
};
