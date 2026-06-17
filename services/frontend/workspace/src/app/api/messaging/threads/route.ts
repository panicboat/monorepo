import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";
import type { Message, Thread } from "@/stub/messaging/v1/messaging_service_pb";
import type { ThreadView, MessageView } from "@/modules/messaging/types";

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

function threadProtoToView(t: Thread): ThreadView {
  return {
    id: t.id,
    counterpart: t.counterpart ? profileToSocialAccount(t.counterpart) : null,
    lastMessage: t.lastMessage && t.lastMessage.id ? messageProtoToView(t.lastMessage) : null,
    unreadCount: t.unreadCount || 0,
    lastMessageAt: timestampToIso(t.lastMessageAt),
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req.headers);
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
    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const recipientAccountId = body?.recipientAccountId ?? "";
    if (!recipientAccountId) {
      return NextResponse.json({ error: "recipientAccountId required" }, { status: 400 });
    }
    const res = await messagingClient.getOrCreateThread({ recipientAccountId }, { headers });
    return NextResponse.json({
      thread: res.thread ? threadProtoToView(res.thread) : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetOrCreateThread");
  }
}
