import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const res = await karteClient.getMyAccess({}, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({
      hasAccess: !!res.hasAccess,
      grantedAt: res.grantedAt
        ? new Date(Number(res.grantedAt.seconds) * 1000).toISOString()
        : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetMyKarteAccess");
  }
}
