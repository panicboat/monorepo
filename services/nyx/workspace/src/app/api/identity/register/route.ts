import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

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
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "Register");
  }
}
