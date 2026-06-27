import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const body = await req.json();
    const targetAccountId = body?.targetAccountId ?? "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "targetAccountId required" }, { status: 400 });
    }
    const res = await socialFollowClient.follow({ targetAccountId }, { headers });
    return NextResponse.json({ status: res.status });
  } catch (error: unknown) {
    return handleApiError(error, "Follow");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const targetAccountId = req.nextUrl.searchParams.get("target_account_id") || "";
    const cancel = req.nextUrl.searchParams.get("cancel") === "1";
    if (!targetAccountId) {
      return NextResponse.json({ error: "target_account_id required" }, { status: 400 });
    }
    if (cancel) {
      await socialFollowClient.cancelFollowRequest({ targetAccountId }, { headers });
    } else {
      await socialFollowClient.unfollow({ targetAccountId }, { headers });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unfollow");
  }
}
