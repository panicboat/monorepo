import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const res = await notificationClient.markAllRead({}, { headers });
    return NextResponse.json({ affected: res.affected || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "MarkAllRead");
  }
}
