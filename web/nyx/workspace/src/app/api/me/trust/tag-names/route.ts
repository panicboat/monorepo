import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await trustClient.listMyTagNames(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ tagNames: response.tagNames || [] });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyTagNames");
  }
}
