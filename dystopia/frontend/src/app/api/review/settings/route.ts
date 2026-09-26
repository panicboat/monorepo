import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const res = await reviewClient.getMySettings({}, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ reviewsVisible: !!res.reviewsVisible });
  } catch (error: unknown) {
    return handleApiError(error, "GetReviewSettings");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await req.json();
    const reviewsVisible = !!body.reviewsVisible;
    const res = await reviewClient.updateMySettings(
      { reviewsVisible },
      { headers: await buildGrpcHeaders(req) }
    );
    return NextResponse.json({ reviewsVisible: !!res.reviewsVisible });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateReviewSettings");
  }
}
