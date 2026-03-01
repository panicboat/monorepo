"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/swr";

export type HttpMethod = "POST" | "PUT" | "DELETE" | "PATCH";

export interface UseApiMutationOptions<TPayload, TResponse> {
  /** API URL */
  apiUrl: string;
  /** HTTP method (default: POST) */
  method?: HttpMethod;
  /** Transform response data */
  mapResponse?: (data: unknown) => TResponse;
  /** Transform payload before sending */
  mapPayload?: (payload: TPayload) => unknown;
  /** Callback on success */
  onSuccess?: (data: TResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseApiMutationReturn<TPayload, TResponse> {
  mutate: (payload: TPayload) => Promise<TResponse>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Generic hook for API mutations (POST/PUT/DELETE).
 * Handles authentication, loading state, and error handling.
 */
export function useApiMutation<TPayload = unknown, TResponse = unknown>(
  options: UseApiMutationOptions<TPayload, TResponse>
): UseApiMutationReturn<TPayload, TResponse> {
  const {
    apiUrl,
    method = "POST",
    mapResponse = (data) => data as TResponse,
    mapPayload = (payload) => payload,
    onSuccess,
    onError,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (payload: TPayload): Promise<TResponse> => {
      const token = getAuthToken();
      if (!token) {
        const err = new Error("Authentication required");
        setError(err);
        onError?.(err);
        throw err;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(apiUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(mapPayload(payload)),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Request failed: ${res.status}`);
        }

        const data = await res.json();
        const result = mapResponse(data);
        onSuccess?.(result);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, method, mapResponse, mapPayload, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Helper for creating multiple mutation hooks with shared config.
 */
export function createMutationHook<TPayload, TResponse>(
  baseOptions: Omit<UseApiMutationOptions<TPayload, TResponse>, "onSuccess" | "onError">
) {
  return function useMutation(
    callbacks?: Pick<UseApiMutationOptions<TPayload, TResponse>, "onSuccess" | "onError">
  ) {
    return useApiMutation<TPayload, TResponse>({
      ...baseOptions,
      ...callbacks,
    });
  };
}
