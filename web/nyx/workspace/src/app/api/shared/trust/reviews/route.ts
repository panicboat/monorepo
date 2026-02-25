import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

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

    // FALLBACK: Returns empty array when response reviews is missing
    const reviews = (response.reviews || []).map((r) => ({
      id: r.id,
      reviewerId: r.reviewerId,
      revieweeId: r.revieweeId,
      content: r.content,
      score: r.score,
      status: r.status,
      createdAt: r.createdAt,
      reviewerName: r.reviewerName,
      reviewerAvatarUrl: r.reviewerAvatarUrl,
      reviewerProfileId: r.reviewerProfileId,
    }));

    return NextResponse.json({
      reviews,
      nextCursor: response.nextCursor || null,
      hasMore: response.hasMore || false,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviews");
  }
}
