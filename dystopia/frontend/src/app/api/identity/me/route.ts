import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { clearAuthCookies, getAccessCookie } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function GET(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    let sub: string;
    try {
      ({ sub } = await verifyAccessToken(accessToken));
    } catch {
      // FALLBACK: Clear the session when the access token cannot be verified after the proxy refresh.
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const headers = await buildGrpcHeaders(req);
    const { account } = await identityClient.getAccount(
      { sub },
      { headers },
    );
    return NextResponse.json({ account: { id: account!.id, role: account!.role } });
  } catch (error) {
    return handleApiError(error, "Me");
  }
}
