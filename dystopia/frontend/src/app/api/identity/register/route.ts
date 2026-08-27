import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password } = (await req.json()) as {
      phoneNumber: string;
      password: string;
    };

    try {
      await cognito().signUp(phoneNumber, password);
    } catch (err) {
      if (err instanceof Error && /UsernameExistsException/.test(err.message)) {
        return NextResponse.json(
          { error: "この電話番号は既に登録されています" },
          { status: 409 },
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Register");
  }
}
