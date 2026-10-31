import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapReviewToView, mapSummaryToView } from "@/modules/review/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const targetProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listReviewsByTarget({ targetProfileId, limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      reviews: (res.reviews || []).map(mapReviewToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      hiddenByLock: !!res.hiddenByLock,
      summary: mapSummaryToView(res.summary),
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByTarget");
  }
}
