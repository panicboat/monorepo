/**
 * Request utilities for consistent header handling across the application.
 *
 * Provides:
 * - X-Request-ID generation for request tracing
 * - Authorization header handling
 */

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
 * Propagates Authorization and X-Request-ID from the incoming request.
 *
 * @param incomingHeaders - Headers from the incoming Next.js request
 * @returns Headers object for gRPC call
 */
export function buildGrpcHeaders(incomingHeaders: Headers): Record<string, string> {
  const headers: Record<string, string> = {};

  // Propagate or generate X-Request-ID
  const requestId = incomingHeaders.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
  headers[HEADER_NAMES.REQUEST_ID] = requestId;

  // Propagate Authorization if present
  const authHeader = incomingHeaders.get(HEADER_NAMES.AUTHORIZATION);
  if (authHeader) {
    headers[HEADER_NAMES.AUTHORIZATION] = authHeader;
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
