import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { cognito } from "@/lib/cognito/adapter";
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
      const r = await cognito().refreshTokens(refreshToken);
      if (!r.accessToken) {
        throw new Error("refresh response missing tokens");
      }
      refreshed = { accessToken: r.accessToken, refreshToken };
      ({ sub: refreshedUserId } = await verifyAccessToken(
        refreshed.accessToken,
      ));
    } catch {
      // FALLBACK: Clear invalid session cookies and return 401 when refresh fails.
      const res = NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
      clearAuthCookies(res);
      return { ok: false, response: res };
    }

    const retryHeaders = await buildGrpcHeaders(req);
    // Use the verified subject because retry metadata may still contain the expired identity.
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
