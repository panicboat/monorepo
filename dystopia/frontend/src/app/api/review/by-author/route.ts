import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapReviewToView } from "@/modules/review/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const authorProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!authorProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listReviewsByAuthor({ authorProfileId, limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      reviews: (res.reviews || []).map(mapReviewToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      hiddenByLock: !!res.hiddenByLock,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByAuthor");
  }
}
