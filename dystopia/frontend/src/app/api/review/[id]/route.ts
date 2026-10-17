import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { respondWithReview } from "../review-response";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithReview(req, "GetReview", (headers) => reviewClient.getReview({ reviewId: id }, { headers }));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await reviewClient.deleteReview({ reviewId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteReview");
  }
}
