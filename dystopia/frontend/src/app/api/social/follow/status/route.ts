import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const targetProfileIds: string[] = Array.isArray(body?.targetProfileIds) ? body.targetProfileIds : [];
    if (targetProfileIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }
    const res = await socialFollowClient.getFollowStatus({ targetProfileIds }, { headers });
    return NextResponse.json({ statuses: res.statuses || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetFollowStatus");
  }
}
