import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { setAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, password, verificationToken, role } = body;

    const response = await identityClient.register(
      {
        phoneNumber,
        password,
        verificationToken,
        role,
      },
      { headers: buildGrpcHeaders(req) }
    );

    if (!response.accessToken || !response.refreshToken) {
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
    }

    const res = NextResponse.json({ account: response.account });
    setAuthCookies(res, {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "Register");
  }
}
