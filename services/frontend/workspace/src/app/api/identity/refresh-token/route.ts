import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { getRefreshCookie, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  try {
    let refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      // FALLBACK: accept the legacy { refreshToken } body while H8b migrates
      // the client off localStorage. Removed in H9.
      try {
        const body = await req.json();
        if (body && typeof body.refreshToken === "string") {
          refreshToken = body.refreshToken;
        }
      } catch {
        // FALLBACK: empty body is fine — cookie was already checked above.
      }
    }

    if (!refreshToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const response = await identityClient.refreshToken(
      { refreshToken },
      { headers: buildGrpcHeaders(req) }
    );

    const res = NextResponse.json(response);
    if (response.accessToken && response.refreshToken) {
      setAuthCookies(res, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    }
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
