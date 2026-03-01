import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    const response = await identityClient.refreshToken(
      { refreshToken },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.UNAUTHENTICATED) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }
    return handleApiError(error, "RefreshToken");
  }
}
