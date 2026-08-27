import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = (await req.json()) as { phoneNumber: string };

    try {
      await cognito().forgotPassword(phoneNumber);
    } catch (err) {
      // Prevent user enumeration by returning the same response for unknown users.
      if (err instanceof Error && err.name === "UserNotFoundException") {
        return NextResponse.json({ ok: true });
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "ForgotPassword");
  }
}
