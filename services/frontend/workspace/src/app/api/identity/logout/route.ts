import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getRefreshCookie, clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshCookie(req);

    // Always clear cookies, even if there is no upstream token to revoke,
    // so a missing refresh cookie does not leave a stale session on the device.
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
