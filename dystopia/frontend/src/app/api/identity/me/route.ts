import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function GET(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    let sub: string;
    try {
      ({ sub } = await verifyAccessToken(accessToken));
    } catch {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const { account } = await identityClient.getAccount(
      { sub },
      { headers: await buildGrpcHeaders(req) },
    );
    return NextResponse.json({ account: { id: account!.id, role: account!.role } });
  } catch (error) {
    return handleApiError(error, "Me");
  }
}
