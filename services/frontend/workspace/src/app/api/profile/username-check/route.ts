import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const username = req.nextUrl.searchParams.get("username") || "";
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.checkUsernameAvailability({ username }, { headers });
    return NextResponse.json({ available: res.available, message: res.message });
  } catch (error: unknown) {
    return handleApiError(error, "CheckUsernameAvailability");
  }
}
