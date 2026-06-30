/**
 * httpOnly cookie helpers for BFF token mediation.
 *
 * Tokens are kept in httpOnly cookies so XSS cannot read them, and the BFF
 * — not client JS — attaches them to upstream gRPC calls. Cookies are
 * Secure + SameSite=Lax + Path=/, which blocks cross-site cookie attachment
 * on mutations (we never use GET for state changes, so SameSite=Lax is
 * sufficient and no separate CSRF token is needed).
 */

import { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

// Mirror the backend TTLs so cookie lifetime matches token lifetime.
// Access TTL = 1h (JWT TTL), refresh TTL = 30d (post-H7).
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const isProd = process.env.NODE_ENV === "production";

// Dogfood escape: production build (`pnpm build && pnpm start`) sets
// secure=true, which Chrome refuses to persist over http://localhost.
// Local headless e2e runs need a way to override that — only that.
// Why a separate env var instead of relaxing on NODE_ENV alone: we
// still want a deployed `pnpm start` instance to be secure by default;
// the escape must be explicit and noisy.
const insecureCookieEscape = process.env.DOGFOOD_INSECURE_COOKIES === "true";
if (isProd && insecureCookieEscape) {
  // Fail-loud at boot so a stray env var in a deployed environment is
  // obvious in the logs. Never silently downgrade cookie security.
  console.warn(
    "[cookies] DOGFOOD_INSECURE_COOKIES=true detected with NODE_ENV=production. " +
      "Cookies will NOT have the Secure flag. This must ONLY happen in local " +
      "dogfood — production deploys must keep this env var unset."
  );
}
const cookieSecure = isProd && !insecureCookieEscape;

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
