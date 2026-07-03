import { NextRequest } from "next/server";
import { messagingStreamingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import type { Event } from "@/stub/messaging/v1/messaging_service_pb";

function timestampToIso(ts: { seconds?: bigint | number; nanos?: number } | undefined): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

type SerializedEvent =
  | {
      type: "message";
      data: {
        id: string;
        threadId: string;
        senderId: string;
        content: string;
        createdAt: string;
      };
    }
  | {
      type: "read_state";
      data: { threadId: string; accountId: string; lastReadMessageId: string };
    }
  | { type: "typing"; data: { threadId: string; accountId: string } };

function serializeEvent(event: Event): SerializedEvent | null {
  if (event.payload.case === "messageEvent") {
    const m = event.payload.value;
    return {
      type: "message",
      data: {
        id: m.id,
        threadId: m.threadId,
        senderId: m.senderId,
        content: m.content,
        createdAt: timestampToIso(m.createdAt),
      },
    };
  } else if (event.payload.case === "readState") {
    const r = event.payload.value;
    return {
      type: "read_state",
      data: {
        threadId: r.threadId,
        accountId: r.accountId,
        lastReadMessageId: r.lastReadMessageId,
      },
    };
  } else if (event.payload.case === "typing") {
    const t = event.payload.value;
    return { type: "typing", data: { threadId: t.threadId, accountId: t.accountId } };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const headers = buildGrpcHeaders(req);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const event of messagingStreamingClient.streamEvents(
          {},
          { headers, signal: req.signal }
        )) {
          const serialized = serializeEvent(event);
          if (!serialized) continue;
          controller.enqueue(enc.encode(`data: ${JSON.stringify(serialized)}\n\n`));
        }
      } catch {
        // SILENT: signal aborted = client tab closed、正常終了扱い
      } finally {
        try {
          controller.close();
        } catch {
          // SILENT: already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

export const dynamic = "force-dynamic";
