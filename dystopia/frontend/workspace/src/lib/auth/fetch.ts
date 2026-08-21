"use client";

import { useAuthStore } from "@/stores/authStore";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
  cache?: RequestCache;
  /**
   * Client-side hard deadline. The BFF -> monolith path also carries a
   * 15s gRPC deadline (lib/grpc.ts), so 20s here gives the server the full
   * budget plus a small overhead. Without this, a stuck fetch leaves the
   * UI on its loading spinner forever.
   */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true, cache, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (requireAuth && !useAuthStore.getState().userId) {
    throw new AppError("UNAUTHORIZED", "ログインしてください", 401);
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
      signal: controller.signal,
    });
  } catch (cause) {
    // AbortError = client-side timeout; surface as NETWORK so the caller
    // shows the same "接続を確認してください" hint and stops the spinner
    // instead of hanging indefinitely.
    throw new AppError(
      "NETWORK",
      "ネットワーク接続を確認してください",
      undefined,
      cause
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    // FALLBACK: Returns empty object when JSON parse fails
    const errBody = await res.json().catch(() => ({}));
    const code = httpStatusToErrorCode(res.status);
    const message = errBody.error || getDefaultMessage(code);
    throw new AppError(code, message, res.status, errBody);
  }

  return res.json();
}
