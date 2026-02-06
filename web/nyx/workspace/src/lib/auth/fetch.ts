"use client";

import { getAuthToken } from "@/lib/swr";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
};

/**
 * Authenticated fetch utility for API calls.
 * Handles token injection, JSON serialization, and error responses.
 */
export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true } = options;
  const token = getAuthToken();

  if (requireAuth && !token) {
    throw new Error("Authentication required");
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
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }

  return res.json();
}
