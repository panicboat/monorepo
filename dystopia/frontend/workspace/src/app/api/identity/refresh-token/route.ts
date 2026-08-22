import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { getRefreshCookie, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const response = await identityClient.refreshToken(
      { refreshToken },
      { headers: buildGrpcHeaders(req) }
    );

    if (!response.accessToken || !response.refreshToken) {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    return res;
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.UNAUTHENTICATED) {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }
    return handleApiError(error, "RefreshToken");
  }
}
