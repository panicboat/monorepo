import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const targetAccountIds: string[] = Array.isArray(body?.targetAccountIds) ? body.targetAccountIds : [];
    if (targetAccountIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }
    const res = await socialFollowClient.getFollowStatus({ targetAccountIds }, { headers });
    return NextResponse.json({ statuses: res.statuses || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetFollowStatus");
  }
}
