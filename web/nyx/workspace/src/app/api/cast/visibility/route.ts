import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastVisibility } from "@/stub/portfolio/v1/cast_service_pb";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const isPrivate = body.isPrivate === true;

    const visibility = isPrivate
      ? CastVisibility.PRIVATE
      : CastVisibility.PUBLIC;

    const response = await castClient.saveCastVisibility(
      { visibility },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      isPrivate: response.profile?.visibility === CastVisibility.PRIVATE,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SaveCastVisibility");
  }
}
