import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await identityClient.getCurrentUser(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "GetCurrentUser");
  }
}
