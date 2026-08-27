import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (accessToken) {
      await cognito().globalSignOut(accessToken).catch(() => {
        // SILENT: local cookie removal must complete when Cognito sign-out fails.
      });
    }

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "Logout");
  }
}
