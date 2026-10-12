"use client";

import { authFetch } from "@/lib/auth/fetch";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { MessageComposer } from "./MessageComposer";

interface Props { recipientProfileId: string; onSent: (threadId: string) => void; }

export function MessageDraft({ recipientProfileId, onSent }: Props) {
  const { capture, scopeId } = useViewScope(true, recipientProfileId);
  return <MessageComposer key={scopeId} onSend={async (content) => {
    const request = capture();
    const result = await authFetch<{ threadId: string; message: { id: string } | null }>("/api/messaging/messages", { method: "POST", body: { recipientProfileId, content } });
    if (!result.threadId || !result.message) throw new Error("保存したメッセージを確認できませんでした");
    if (request.isCurrent()) onSent(result.threadId);
  }} />;
}
