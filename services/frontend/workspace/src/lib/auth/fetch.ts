"use client";

import { useAuthStore } from "@/stores/authStore";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
  cache?: RequestCache;
};

export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true, cache } = options;

  if (requireAuth && !useAuthStore.getState().userId) {
    throw new AppError("UNAUTHORIZED", "ログインしてください", 401);
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
    });
  } catch (cause) {
    throw new AppError(
      "NETWORK",
      "ネットワーク接続を確認してください",
      undefined,
      cause
    );
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
