import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import type { Message } from "@/stub/messaging/v1/messaging_service_pb";
import type { MessageView } from "@/modules/messaging/types";

function timestampToIso(ts: { seconds?: bigint | number; nanos?: number } | undefined): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

function messageProtoToView(m: Message): MessageView {
  return {
    id: m.id,
    threadId: m.threadId,
    senderId: m.senderId,
    content: m.content,
    createdAt: timestampToIso(m.createdAt),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await messagingClient.listMessages(
      { threadId: id, limit, cursor },
      { headers }
    );
    return NextResponse.json({
      messages: (res.messages || []).map(messageProtoToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListMessages");
  }
}
