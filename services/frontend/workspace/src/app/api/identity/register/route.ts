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

    // FALLBACK: response body still carries accessToken/refreshToken for the
    // current client (authStore reads them). H8b moves the client off body
    // tokens; H9 then strips the tokens from the response.
    const res = NextResponse.json(response);
    if (response.accessToken && response.refreshToken) {
      setAuthCookies(res, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    }
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "Register");
  }
}
