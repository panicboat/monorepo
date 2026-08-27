import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { getRefreshCookie, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    let refreshed;
    try {
      refreshed = await cognito().refreshTokens(refreshToken);
    } catch {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, {
      accessToken: refreshed.accessToken,
      refreshToken,
    });
    return res;
  } catch (error) {
    return handleApiError(error, "RefreshToken");
  }
}
