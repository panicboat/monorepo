import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const res = await notificationClient.getPushConfig({}, { headers });
    return NextResponse.json({ vapidPublicKey: res.vapidPublicKey });
  } catch (error: unknown) {
    return handleApiError(error, "GetPushConfig");
  }
}
