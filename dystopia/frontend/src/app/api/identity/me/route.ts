import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders, HEADER_NAMES } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import {
  clearAuthCookies,
  getAccessCookie,
  getRefreshCookie,
  setAuthCookies,
} from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function GET(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    let sub: string;
    let refreshed: { accessToken: string; refreshToken: string } | null = null;
    try {
      ({ sub } = await verifyAccessToken(accessToken));
    } catch {
      const refreshToken = getRefreshCookie(req);
      if (!refreshToken) {
        const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
        clearAuthCookies(res);
        return res;
      }

      try {
        const tokens = await cognito().refreshTokens(refreshToken);
        ({ sub } = await verifyAccessToken(tokens.accessToken));
        refreshed = { accessToken: tokens.accessToken, refreshToken };
      } catch {
        const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
        clearAuthCookies(res);
        return res;
      }
    }

    const headers = await buildGrpcHeaders(req);
    if (refreshed) headers[HEADER_NAMES.USER_ID] = sub;
    const { account } = await identityClient.getAccount(
      { sub },
      { headers },
    );
    const res = NextResponse.json({ account: { id: account!.id, role: account!.role } });
    if (refreshed) setAuthCookies(res, refreshed);
    return res;
  } catch (error) {
    return handleApiError(error, "Me");
  }
}
