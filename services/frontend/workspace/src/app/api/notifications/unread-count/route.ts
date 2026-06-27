import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const res = await notificationClient.getUnreadCount({}, { headers });
    return NextResponse.json({ count: res.count || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "GetUnreadCount");
  }
}
