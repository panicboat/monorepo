import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    await identityClient.deactivateAccount({}, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeactivateAccount");
  }
}
