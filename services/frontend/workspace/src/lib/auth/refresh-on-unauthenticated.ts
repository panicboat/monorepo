/**
 * BFF helper: run an upstream gRPC call, and on UNAUTHENTICATED transparently
 * refresh the access token using the refresh cookie, then retry the call once.
 *
 * Tokens stay in httpOnly cookies; the client never sees them. New cookies
 * (rotated refresh + fresh access) are set on the outgoing response so the
 * next request from the same client uses the refreshed token.
 */

import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { buildGrpcHeaders } from "@/lib/request";
import {
  getRefreshCookie,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_COOKIE,
} from "./cookies";

export type CallWithRefreshResult<T> =
  | { ok: true; data: T; refreshed: { accessToken: string; refreshToken: string } | null }
  | { ok: false; response: NextResponse };

export async function callWithRefresh<T>(
  req: NextRequest,
  call: (headers: Record<string, string>) => Promise<T>
): Promise<CallWithRefreshResult<T>> {
  try {
    const data = await call(buildGrpcHeaders(req));
    return { ok: true, data, refreshed: null };
  } catch (error: unknown) {
    if (!isConnectError(error) || error.code !== GrpcCode.UNAUTHENTICATED) {
      throw error;
    }

    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      const res = NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
      clearAuthCookies(res);
      return { ok: false, response: res };
    }

    let refreshed: { accessToken: string; refreshToken: string };
    try {
      const r = await identityClient.refreshToken(
        { refreshToken },
        { headers: buildGrpcHeaders(req) }
      );
      if (!r.accessToken || !r.refreshToken) {
        throw new Error("refresh response missing tokens");
      }
      refreshed = { accessToken: r.accessToken, refreshToken: r.refreshToken };
    } catch {
      const res = NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
      clearAuthCookies(res);
      return { ok: false, response: res };
    }

    // Retry the original call with the freshly issued access token.
    // We override the cookie on the headers built from req so the upstream
    // call uses the new token without waiting for the next client request.
    const retryHeaders = buildGrpcHeaders(req);
    retryHeaders.Authorization = `Bearer ${refreshed.accessToken}`;
    void ACCESS_COOKIE; // Silence unused-import in environments that tree-shake.
    const data = await call(retryHeaders);
    return { ok: true, data, refreshed };
  }
}

export function applyRefreshedCookies(
  res: NextResponse,
  refreshed: { accessToken: string; refreshToken: string } | null
): NextResponse {
  if (refreshed) setAuthCookies(res, refreshed);
  return res;
}
