import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");

    if (!revieweeId) {
      return NextResponse.json(
        { error: "reviewee_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.getReviewStats(
      { revieweeId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const stats = response.stats
      ? {
          averageScore: response.stats.averageScore,
          totalReviews: response.stats.totalReviews,
          approvalRate: response.stats.approvalRate,
        }
      : null;

    return NextResponse.json({ stats });
  } catch (error: unknown) {
    return handleApiError(error, "GetReviewStats");
  }
}
