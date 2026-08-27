import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { setAuthCookies } from "@/lib/auth/cookies";
import { cognito, type Tokens } from "@/lib/cognito/adapter";
import { verifyAccessToken } from "@/lib/cognito/jwks";

const invalidCredentials = {
  error: "電話番号または認証コードが正しくありません",
};

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password, role } = (await req.json()) as {
      phoneNumber: string;
      password: string;
      role: number;
    };

    let tokens: Tokens;
    try {
      tokens = await cognito().initiateAuth(phoneNumber, password);
    } catch (err) {
      const info = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.warn(`sign-in initiateAuth failed: ${info}`);
      return NextResponse.json(invalidCredentials, { status: 401 });
    }

    const { sub } = await verifyAccessToken(tokens.accessToken);
    const headers = await buildGrpcHeaders(req);
    const { account } = await identityClient.getAccount({ sub }, { headers });

    if (!account || account.role !== role) {
      await cognito()
        .globalSignOut(tokens.accessToken)
        .catch(() => {
          // SILENT: sign-out cleanup must not mask the authentication failure.
        });
      return NextResponse.json(invalidCredentials, { status: 401 });
    }

    let reactivated = false;
    if (account.deactivatedAt) {
      await identityClient.reactivateAccount({ sub }, { headers });
      reactivated = true;
    }

    const res = NextResponse.json({
      account: { id: account.id, role: account.role },
      reactivated,
    });
    setAuthCookies(res, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "SignIn");
  }
}
