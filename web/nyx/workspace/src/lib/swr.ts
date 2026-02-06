import { SWRConfiguration } from "swr";

import { useAuthStore } from "@/stores/authStore";

/**
 * Get auth token from authStore
 * Use this for all authenticated API calls in hooks.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().accessToken;
}

/**
 * Default fetcher for SWR
 * Automatically includes authorization header if token exists
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  const token = getAuthToken();
  const headers: HeadersInit = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    (error as unknown as { status: number }).status = res.status;
    (error as unknown as { info: unknown }).info = await res
      .json()
      .catch(() => ({}));
    throw error;
  }

  return res.json();
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
