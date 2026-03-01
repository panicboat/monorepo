import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastVisibility } from "@/stub/portfolio/v1/cast_service_pb";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    // Complete onboarding with public visibility
    const response = await castClient.saveCastVisibility(
      { visibility: CastVisibility.PUBLIC },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "SaveCastVisibility");
  }
}
