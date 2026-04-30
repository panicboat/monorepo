import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProtoReviewStatsToJson } from "@/modules/trust/lib/api-mappers";

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

    return NextResponse.json({
      stats: mapProtoReviewStatsToJson(response.stats),
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetReviewStats");
  }
}
