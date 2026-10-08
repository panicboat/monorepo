"use client";

import { useAuthStore } from "@/stores/authStore";
import { profileRequestHeaders } from "@/lib/auth/profile-headers";
import { isProfileSelectionError, resetProfileSelection } from "@/lib/auth/profile-errors";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
  cache?: RequestCache;
  // Keep this deadline above the BFF gRPC deadline so stalled requests do not leave the UI loading.
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true, cache, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (requireAuth && !useAuthStore.getState().accountId) {
    throw new AppError("UNAUTHORIZED", "ログインしてください", 401);
  }

  const headers: Record<string, string> = { ...profileRequestHeaders() };
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
    // Map client timeouts to NETWORK so callers can stop the loading state.
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
    // FALLBACK: Use an empty object when the error body is not JSON.
    const errBody = await res.json().catch(() => ({}));
    if (isProfileSelectionError(errBody)) resetProfileSelection();
    const code = httpStatusToErrorCode(res.status);
    const message = errBody.error || getDefaultMessage(code);
    throw new AppError(code, message, res.status, errBody);
  }

  return res.json();
}
