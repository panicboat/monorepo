import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const accountId = req.nextUrl.searchParams.get("account_id") || "";

    const res = await socialFollowClient.getSocialCounts({ accountId }, { headers });
    return NextResponse.json({
      followingCount: res.followingCount || 0,
      followersCount: res.followersCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetSocialCounts");
  }
}
