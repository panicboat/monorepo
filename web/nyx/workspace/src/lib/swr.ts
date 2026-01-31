import { SWRConfiguration } from "swr";
import { getAccessToken } from "@/lib/auth";

/**
 * Default fetcher for SWR
 * Automatically includes authorization header if token exists
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  // Default to cast token for backward compatibility
  const token = getAccessToken("cast");
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
    (error as any).status = res.status;
    (error as any).info = await res.json().catch(() => ({}));
    throw error;
  }

  return res.json();
};

/**
 * Default SWR configuration
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,  // Disable auto-revalidation on window focus
  revalidateOnReconnect: true,
  dedupingInterval: 2000,    // Dedupe requests within 2 seconds
  errorRetryCount: 3,
};
