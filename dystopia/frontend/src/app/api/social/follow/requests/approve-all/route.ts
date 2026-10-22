import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const res = await socialFollowClient.approveAllFollowRequests({}, { headers });
    return NextResponse.json({ approvedCount: res.approvedCount });
  } catch (error: unknown) {
    return handleApiError(error, "ApproveAllFollowRequests");
  }
}
