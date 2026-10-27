import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";
import { INVALID_PASSWORD_MESSAGE, isInvalidPasswordError } from "@/lib/cognito/password";

function isUsernameExistsError(err: unknown): boolean {
  return err instanceof Error && err.name === "UsernameExistsException";
}

async function signUpReleasingIncomplete(phone: string, password: string): Promise<void> {
  try {
    await cognito().signUp(phone, password);
  } catch (err) {
    if (!isUsernameExistsError(err) || !(await cognito().releaseIncompleteSignUp(phone))) throw err;
    await cognito().signUp(phone, password);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password } = (await req.json()) as {
      phoneNumber: string;
      password: string;
    };

    try {
      await signUpReleasingIncomplete(phoneNumber, password);
    } catch (err) {
      if (isUsernameExistsError(err)) {
        return NextResponse.json(
          { error: "この電話番号は既に登録されています" },
          { status: 409 },
        );
      }
      if (isInvalidPasswordError(err)) {
        return NextResponse.json({ error: INVALID_PASSWORD_MESSAGE }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Register");
  }
}
