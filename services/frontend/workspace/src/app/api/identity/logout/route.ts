import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getRefreshCookie, clearAuthCookies } from "@/lib/auth/cookies";

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

    // Always attempt server revoke (when we have a token) and always clear cookies,
    // so a missing token does not leave the session live on the device.
    if (refreshToken) {
      await identityClient.logout(
        { refreshToken },
        { headers: buildGrpcHeaders(req) }
      );
    }

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "Logout");
  }
}
