import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requesterProfileId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { requesterProfileId } = await params;
    const headers = await buildGrpcHeaders(req);
    await socialFollowClient.approveFollowRequest({ requesterProfileId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "ApproveFollowRequest");
  }
}
