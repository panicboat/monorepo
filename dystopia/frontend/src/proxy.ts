import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt } from "jose";
import { ACCESS_COOKIE, getAccessCookie, getRefreshCookie, setAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

const REFRESH_MARGIN_SECONDS = 60;
const SESSION_CHECK_PATH = "/api/identity/me";

function needsRefresh(accessToken: string | null): boolean {
  if (!accessToken) return true;
  try {
    const { exp } = decodeJwt(accessToken);
    return typeof exp !== "number" || exp - REFRESH_MARGIN_SECONDS <= Date.now() / 1000;
  } catch {
    // SILENT: A malformed access token is replaced by refreshing it.
    return true;
  }
}

// Other identity routes set or clear the auth cookies themselves, so refreshing there would race their Set-Cookie.
function handlesOwnCookies(pathname: string): boolean {
  return pathname.startsWith("/api/identity/") && pathname !== SESSION_CHECK_PATH;
}

export async function proxy(req: NextRequest) {
  const refreshToken = getRefreshCookie(req);
  if (!refreshToken || handlesOwnCookies(req.nextUrl.pathname) || !needsRefresh(getAccessCookie(req))) {
    return NextResponse.next();
  }

  let accessToken: string;
  try {
    ({ accessToken } = await cognito().refreshTokens(refreshToken));
  } catch {
    // FALLBACK: Pass the request through so the route answers 401 and the client signs out.
    return NextResponse.next();
  }

  req.cookies.set(ACCESS_COOKIE, accessToken);
  const res = NextResponse.next({ request: { headers: req.headers } });
  setAuthCookies(res, { accessToken, refreshToken });
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
