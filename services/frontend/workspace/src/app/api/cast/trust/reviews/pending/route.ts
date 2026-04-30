import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProtoReviewsListToJson } from "@/modules/trust/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await trustClient.listPendingReviews(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const { reviews } = mapProtoReviewsListToJson(response);

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    return handleApiError(error, "ListPendingReviews");
  }
}
