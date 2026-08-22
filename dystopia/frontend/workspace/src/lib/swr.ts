import { SWRConfiguration } from "swr";

export const fetcher = async <T>(url: string): Promise<T> => {
  const { authFetch } = await import("@/lib/auth/fetch");
  return authFetch<T>(url, {
    method: "GET",
    requireAuth: false,
    cache: "no-store",
  });
};

export const authFetcher = async <T>(url: string): Promise<T> => {
  const { authFetch } = await import("@/lib/auth/fetch");
  return authFetch<T>(url, {
    method: "GET",
    requireAuth: true,
    cache: "no-store",
  });
};

export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
};
