import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { setAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
    const { phoneNumber, password, role } = body as { phoneNumber: string; password: string; role: number };

    const response = await identityClient.login(
      {
        phoneNumber,
        password,
        role,
      },
      { headers: buildGrpcHeaders(req) }
    );

    if (!response.accessToken || !response.refreshToken) {
      return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
    }

    const res = NextResponse.json({ account: response.account, reactivated: !!response.reactivated });
    setAuthCookies(res, {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    return res;
  } catch (error: unknown) {
    // ACCOUNT_LOCKED arrives as FAILED_PRECONDITION with body "ACCOUNT_LOCKED:<seconds>".
    // Surface as 423 Locked + a distinct payload so the UI shows a real wait
    // message instead of letting the user keep retrying through the lockout window.
    if (isConnectError(error) && error.code === GrpcCode.FAILED_PRECONDITION) {
      const raw = error.rawMessage || error.message || "";
      const match = raw.match(/ACCOUNT_LOCKED:(\d+)/);
      const retryAfterSeconds = match ? parseInt(match[1], 10) : null;
      const minutes = retryAfterSeconds != null ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : null;
      console.warn(`Login locked: retryAfter=${retryAfterSeconds}s`);
      return NextResponse.json(
        {
          error: "ACCOUNT_LOCKED",
          message: minutes != null
            ? `ログイン失敗が続いたためアカウントを一時的にロックしています。約 ${minutes} 分後にもう一度お試しください。`
            : "ログイン失敗が続いたためアカウントを一時的にロックしています。しばらく時間をおいてお試しください。",
          retryAfterSeconds,
        },
        { status: 423 }
      );
    }
    // Code 16 is Unauthenticated (ConnectRPC/gRPC)
    if (isConnectError(error) && error.code === GrpcCode.UNAUTHENTICATED) {
      // Clean log for expected failures
      console.warn(`Login failed: ${error.rawMessage || error.message}`);
      return NextResponse.json({ error: "電話番号または認証コードが正しくありません" }, { status: 401 });
    }

    return handleApiError(error, "Login");
  }
}
