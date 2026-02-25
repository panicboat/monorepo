import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await trustClient.listPendingReviews(
      {},
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

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    return handleApiError(error, "ListPendingReviews");
  }
}
