import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { setAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code, password, role } = (await req.json()) as {
      phoneNumber: string;
      code: string;
      password: string;
      role: 1 | 2;
    };

    try {
      await cognito().confirmSignUp(phoneNumber, code);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "CodeMismatchException" || err.name === "ExpiredCodeException")
      ) {
        return NextResponse.json(
          { error: "認証コードが正しくありません" },
          { status: 400 },
        );
      }
      throw err;
    }

    const tokens = await cognito().initiateAuth(phoneNumber, password);
    const { sub } = await verifyAccessToken(tokens.accessToken);

    await identityClient.createAccount(
      { sub, role },
      { headers: await buildGrpcHeaders(req) },
    );

    const res = NextResponse.json({ account: { id: sub, role } });
    setAuthCookies(res, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return res;
  } catch (error) {
    return handleApiError(error, "Verify");
  }
}
