import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProfileToView } from "@/modules/profile/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const res = await profileClient.listMyProfiles({}, { headers });
    return NextResponse.json({ profiles: res.profiles.map(mapProfileToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyProfiles");
  }
}
