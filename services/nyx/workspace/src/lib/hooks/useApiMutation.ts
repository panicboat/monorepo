"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/swr";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type HttpMethod = "POST" | "PUT" | "DELETE" | "PATCH";

export interface UseApiMutationOptions<TPayload, TResponse> {
  apiUrl: string;
  method?: HttpMethod;
  mapResponse?: (data: unknown) => TResponse;
  mapPayload?: (payload: TPayload) => unknown;
  onSuccess?: (data: TResponse) => void;
  onError?: (error: AppError) => void;
}

export interface UseApiMutationReturn<TPayload, TResponse> {
  mutate: (payload: TPayload) => Promise<TResponse>;
  loading: boolean;
  error: AppError | null;
  reset: () => void;
}

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
  const [error, setError] = useState<AppError | null>(null);

  const mutate = useCallback(
    async (payload: TPayload): Promise<TResponse> => {
      const token = getAuthToken();
      if (!token) {
        const err = new AppError("UNAUTHORIZED", "ログインしてください", 401);
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
          const code = httpStatusToErrorCode(res.status);
          const message = errBody.error || getDefaultMessage(code);
          throw new AppError(code, message, res.status, errBody);
        }

        const data = await res.json();
        const result = mapResponse(data);
        onSuccess?.(result);
        return result;
      } catch (e) {
        const err =
          e instanceof AppError
            ? e
            : new AppError("UNKNOWN", "予期しないエラーが発生しました", undefined, e);
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

  return { mutate, loading, error, reset };
}

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
