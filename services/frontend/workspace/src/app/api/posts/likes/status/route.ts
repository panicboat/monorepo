import { NextRequest, NextResponse } from "next/server";
import { likeClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const raw = req.nextUrl.searchParams.get("post_ids") || "";
    const postIds = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (postIds.length === 0) {
      return NextResponse.json({ liked: {} });
    }
    const res = await likeClient.getLikeStatus({ postIds }, { headers });
    return NextResponse.json({ liked: res.liked || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetLikeStatus");
  }
}
