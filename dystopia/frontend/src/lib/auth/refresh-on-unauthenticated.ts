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
import { verifyAccessToken } from "@/lib/cognito/jwks";
import { buildGrpcHeaders, HEADER_NAMES } from "@/lib/request";
import { getRefreshCookie, setAuthCookies, clearAuthCookies } from "./cookies";

export type CallWithRefreshResult<T> =
  | {
      ok: true;
      data: T;
      refreshed: { accessToken: string; refreshToken: string } | null;
    }
  | { ok: false; response: NextResponse };

export async function callWithRefresh<T>(
  req: NextRequest,
  call: (headers: Record<string, string>) => Promise<T>,
): Promise<CallWithRefreshResult<T>> {
  try {
    const data = await call(await buildGrpcHeaders(req));
    return { ok: true, data, refreshed: null };
  } catch (error: unknown) {
    if (!isConnectError(error) || error.code !== GrpcCode.UNAUTHENTICATED) {
      throw error;
    }

    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      const res = NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
      clearAuthCookies(res);
      return { ok: false, response: res };
    }

    let refreshed: { accessToken: string; refreshToken: string };
    let refreshedUserId: string;
    try {
      const r = await identityClient.refreshToken(
        { refreshToken },
        { headers: await buildGrpcHeaders(req) },
      );
      if (!r.accessToken || !r.refreshToken) {
        throw new Error("refresh response missing tokens");
      }
      refreshed = { accessToken: r.accessToken, refreshToken: r.refreshToken };
      ({ sub: refreshedUserId } = await verifyAccessToken(
        refreshed.accessToken,
      ));
    } catch {
      const res = NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
      clearAuthCookies(res);
      return { ok: false, response: res };
    }

    // The request still contains the old cookie, so replace its user metadata
    // with the subject from the newly issued and verified access token.
    const retryHeaders = await buildGrpcHeaders(req);
    retryHeaders[HEADER_NAMES.USER_ID] = refreshedUserId;
    const data = await call(retryHeaders);
    return { ok: true, data, refreshed };
  }
}

export function applyRefreshedCookies(
  res: NextResponse,
  refreshed: { accessToken: string; refreshToken: string } | null,
): NextResponse {
  if (refreshed) setAuthCookies(res, refreshed);
  return res;
}
