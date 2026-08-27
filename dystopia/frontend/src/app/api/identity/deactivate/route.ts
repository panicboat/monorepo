import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    await identityClient.deactivateAccount({}, { headers: await buildGrpcHeaders(req) });
    await cognito().globalSignOut(accessToken).catch(() => {
      // SILENT: deactivation must clear local credentials even if Cognito sign-out fails.
    });

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (error) {
    return handleApiError(error, "Deactivate");
  }
}
