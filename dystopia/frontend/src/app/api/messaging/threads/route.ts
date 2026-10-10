import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { threadProtoToView } from "@/modules/messaging/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await messagingClient.listThreads({ limit, cursor }, { headers });
    return NextResponse.json({
      threads: (res.threads || []).map(threadProtoToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      totalUnreadCount: res.totalUnreadCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListThreads");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const recipientProfileId = body?.recipientProfileId ?? "";
    if (!recipientProfileId) {
      return NextResponse.json({ error: "recipientProfileId required" }, { status: 400 });
    }
    const res = await messagingClient.getOrCreateThread({ recipientProfileId }, { headers });
    return NextResponse.json({
      thread: res.thread ? threadProtoToView(res.thread) : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetOrCreateThread");
  }
}
