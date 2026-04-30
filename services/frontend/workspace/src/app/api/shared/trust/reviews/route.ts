import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProtoReviewsListToJson } from "@/modules/trust/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");
    const reviewerId = req.nextUrl.searchParams.get("reviewer_id");
    const status = req.nextUrl.searchParams.get("status");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    if (!revieweeId && !reviewerId) {
      return NextResponse.json(
        { error: "reviewee_id or reviewer_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.listReviews(
      {
        revieweeId: revieweeId || undefined,
        reviewerId: reviewerId || undefined,
        status: status || undefined,
        limit: limit || 0,
        cursor: cursor || undefined,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoReviewsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListReviews");
  }
}
