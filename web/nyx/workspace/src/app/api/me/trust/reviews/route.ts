import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { revieweeId, content, score } = await req.json();
    if (!revieweeId || score === undefined) {
      return NextResponse.json(
        { error: "revieweeId and score are required" },
        { status: 400 }
      );
    }

    const response = await trustClient.createReview(
      { revieweeId, content, score },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success, id: response.id });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.INVALID_ARGUMENT) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return handleApiError(error, "CreateReview");
  }
}
