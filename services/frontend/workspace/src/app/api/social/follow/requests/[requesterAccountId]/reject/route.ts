import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requesterAccountId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { requesterAccountId } = await params;
    const headers = buildGrpcHeaders(req);
    await socialFollowClient.rejectFollowRequest({ requesterAccountId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "RejectFollowRequest");
  }
}
