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
    senderProfileId: m.senderProfileId,
    content: m.content,
    createdAt: timestampToIso(m.createdAt),
  };
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const threadId: string = body?.threadId ?? "";
    const recipientProfileId: string = body?.recipientProfileId ?? "";
    const content: string = body?.content ?? "";

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    if (!threadId && !recipientProfileId) {
      return NextResponse.json(
        { error: "threadId or recipientProfileId required" },
        { status: 400 }
      );
    }

    const res = await messagingClient.sendMessage(
      { threadId, recipientProfileId, content },
      { headers }
    );
    return NextResponse.json({
      message: res.message ? messageProtoToView(res.message) : null,
      threadId: res.threadId || "",
    });
  } catch (error: unknown) {
    return handleApiError(error, "SendMessage");
  }
}
