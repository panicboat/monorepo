import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

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
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    // Code 16 is Unauthenticated (ConnectRPC/gRPC)
    if (isConnectError(error) && error.code === GrpcCode.UNAUTHENTICATED) {
      // Clean log for expected failures
      console.warn(`Login failed for ${(body?.phoneNumber as string) || 'unknown'}: ${error.rawMessage || error.message}`);
      return NextResponse.json({ error: error.rawMessage || error.message }, { status: 401 });
    }

    return handleApiError(error, "Login");
  }
}
