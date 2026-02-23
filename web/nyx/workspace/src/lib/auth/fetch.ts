"use client";

import { getAuthToken } from "@/lib/swr";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
  cache?: RequestCache;
};

/**
 * API Error with status code and response info
 */
export class ApiError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

/**
 * Authenticated fetch utility for API calls.
 * Handles token injection, JSON serialization, and error responses.
 *
 * @example
 * // GET request
 * const data = await authFetch<UserProfile>("/api/user/profile");
 *
 * @example
 * // POST request with body
 * const result = await authFetch<CreateResponse>("/api/posts", {
 *   method: "POST",
 *   body: { content: "Hello" },
 * });
 *
 * @example
 * // Request without caching (for real-time data)
 * const data = await authFetch<Timeline>("/api/timeline", { cache: "no-store" });
 */
export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true, cache } = options;
  const token = getAuthToken();

  if (requireAuth && !token) {
    throw new ApiError("Authentication required", 401);
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
  });

  if (!res.ok) {
    // FALLBACK: Returns empty object when JSON parse fails
    const errBody = await res.json().catch(() => ({}));
    const message = errBody.error || `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, errBody);
  }

  return res.json();
}
