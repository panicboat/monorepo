import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export const HEADER_NAMES = {
  REQUEST_ID: "X-Request-ID",
  USER_ID: "x-user-id",
} as const;

export async function buildGrpcHeaders(
  req: NextRequest,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  const requestId =
    req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
  headers[HEADER_NAMES.REQUEST_ID] = requestId;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      const { sub } = await verifyAccessToken(accessToken);
      headers[HEADER_NAMES.USER_ID] = sub;
    } catch {
      // SILENT: Ignore invalid tokens so downstream handlers can produce the 401 response.
    }
  }

  return headers;
}

export function getOrCreateRequestId(headers: Headers): string {
  return headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
}
