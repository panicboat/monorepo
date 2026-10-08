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
    const targetProfileId = body?.targetProfileId ?? "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "targetProfileId required" }, { status: 400 });
    }
    const res = await socialFollowClient.follow({ targetProfileId }, { headers });
    return NextResponse.json({ status: res.status });
  } catch (error: unknown) {
    return handleApiError(error, "Follow");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const targetProfileId = req.nextUrl.searchParams.get("target_profile_id") || "";
    const cancel = req.nextUrl.searchParams.get("cancel") === "1";
    if (!targetProfileId) {
      return NextResponse.json({ error: "target_profile_id required" }, { status: 400 });
    }
    if (cancel) {
      await socialFollowClient.cancelFollowRequest({ targetProfileId }, { headers });
    } else {
      await socialFollowClient.unfollow({ targetProfileId }, { headers });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unfollow");
  }
}
