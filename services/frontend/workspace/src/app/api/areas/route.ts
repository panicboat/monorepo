import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapAreaToView } from "@/modules/profile/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const prefecture = req.nextUrl.searchParams.get("prefecture") || "";
    const headers = buildGrpcHeaders(req);
    const res = await profileClient.listAreas({ prefecture }, { headers });
    return NextResponse.json({ areas: (res.areas || []).map(mapAreaToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListAreas");
  }
}
