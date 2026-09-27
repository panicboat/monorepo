import { NextRequest, NextResponse } from "next/server";

// Use httpOnly, Secure, and SameSite=Lax cookies so client code cannot access tokens or send state-changing requests cross-site.

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const isProd = process.env.NODE_ENV === "production";

// Allow insecure cookies only for local HTTP tests; production deployments must keep this flag unset.
const insecureCookies = process.env.INSECURE_COOKIES === "true";
if (isProd && insecureCookies) {
  console.warn(
    "[cookies] INSECURE_COOKIES=true detected with NODE_ENV=production. " +
      "Cookies will NOT have the Secure flag. This must ONLY happen on a " +
      "local HTTP-only host — deployed instances must keep this env var unset."
  );
}
const cookieSecure = isProd && !insecureCookies;

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

function baseOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, baseOptions(ACCESS_MAX_AGE));
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, baseOptions(REFRESH_MAX_AGE));
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseOptions(0), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseOptions(0), maxAge: 0 });
}

export function getAccessCookie(req: NextRequest): string | null {
  return req.cookies.get(ACCESS_COOKIE)?.value ?? null;
}

export function getRefreshCookie(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? null;
}
