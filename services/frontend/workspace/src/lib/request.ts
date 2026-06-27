/**
 * Request utilities for consistent header handling across the application.
 *
 * Provides:
 * - X-Request-ID generation for request tracing
 * - Authorization header handling
 */

import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

/**
 * Generates a unique request ID for request tracing.
 * Uses crypto.randomUUID (available in Node.js 19+ and modern browsers).
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Header names used across the application.
 */
export const HEADER_NAMES = {
  REQUEST_ID: "X-Request-ID",
  AUTHORIZATION: "Authorization",
} as const;

/**
 * Builds headers for gRPC calls from the BFF to the backend.
 *
 * Reads the access token from the access_token httpOnly cookie so client JS
 * never holds or transmits the token. The cookie was set by sign-in / register
 * / refresh-token BFFs.
 *
 * @param req - Incoming Next.js request (used for cookies + request id)
 * @returns Headers object for gRPC call
 */
export function buildGrpcHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  // Propagate or generate X-Request-ID
  const requestId = req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
  headers[HEADER_NAMES.REQUEST_ID] = requestId;

  const accessFromCookie = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessFromCookie) {
    headers[HEADER_NAMES.AUTHORIZATION] = `Bearer ${accessFromCookie}`;
  }

  return headers;
}

/**
 * Extracts the request ID from headers, generating one if not present.
 *
 * @param headers - Headers object (from NextRequest or similar)
 * @returns The request ID
 */
export function getOrCreateRequestId(headers: Headers): string {
  return headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
}
