/**
 * Request utilities for consistent header handling across the application.
 *
 * Verifies Cognito access tokens and forwards their subject as gRPC metadata.
 */

import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

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
  USER_ID: "x-user-id",
} as const;

/**
 * Builds headers for gRPC calls from the BFF to the backend.
 *
 * Verifies the access token in the httpOnly cookie before forwarding its
 * subject. Invalid tokens omit user metadata so the downstream handler can
 * return the appropriate unauthenticated response.
 *
 * @param req - Incoming Next.js request (used for cookies + request id)
 * @returns Headers object for gRPC call
 */
export async function buildGrpcHeaders(
  req: NextRequest,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Propagate or generate X-Request-ID
  const requestId =
    req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
  headers[HEADER_NAMES.REQUEST_ID] = requestId;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      const { sub } = await verifyAccessToken(accessToken);
      headers[HEADER_NAMES.USER_ID] = sub;
    } catch {
      // Invalid tokens intentionally omit user metadata for the caller's 401 flow.
    }
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
