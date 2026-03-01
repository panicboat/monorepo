import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await followClient.getPendingFollowCount(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      count: response.count,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetPendingFollowCount");
  }
}
