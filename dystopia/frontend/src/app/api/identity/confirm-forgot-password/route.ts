import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code, newPassword } = (await req.json()) as {
      phoneNumber: string;
      code: string;
      newPassword: string;
    };

    try {
      await cognito().confirmForgotPassword(phoneNumber, code, newPassword);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "CodeMismatchException" || err.name === "ExpiredCodeException")
      ) {
        return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "ConfirmForgotPassword");
  }
}
