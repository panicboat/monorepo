import { profileToSocialProfile } from "@/modules/social";
import type { Message, Thread } from "@/stub/messaging/v1/messaging_service_pb";
import type { MessageView, ThreadView } from "../types";

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

export function threadProtoToView(t: Thread): ThreadView {
  return {
    id: t.id,
    counterpart: t.counterpart ? profileToSocialProfile(t.counterpart) : null,
    lastMessage: t.lastMessage && t.lastMessage.id ? messageProtoToView(t.lastMessage) : null,
    unreadCount: t.unreadCount || 0,
    lastMessageAt: timestampToIso(t.lastMessageAt),
  };
}
