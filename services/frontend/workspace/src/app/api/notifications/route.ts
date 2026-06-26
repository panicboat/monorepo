import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { notificationToView } from "@/modules/notifications";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await notificationClient.listNotifications({ limit, cursor }, { headers });
    return NextResponse.json({
      notifications: (res.notifications || []).map(notificationToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      unreadCount: res.unreadCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListNotifications");
  }
}
