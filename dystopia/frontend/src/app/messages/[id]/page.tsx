"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useMessages, useTyping } from "@/modules/messaging";
import { MessageComposer } from "@/modules/messaging/components/MessageComposer";
import { useAuthStore, selectUserId } from "@/stores/authStore";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const threadId = typeof params.id === "string" ? params.id : "";
  const viewerId = useAuthStore(selectUserId);

  const { messages, hasMore, loading, send, markRead, loadMore } = useMessages(threadId || null);
  const { typingActorId, sendTyping } = useTyping(threadId || null);

  // 最上端の message を read marker として mark (= 最新の to-viewer message)
  useEffect(() => {
    const incoming = messages.find((m) => m.senderId !== viewerId);
    if (incoming) {
      markRead(incoming.id);
    }
  }, [messages, viewerId, markRead]);

  if (!threadId) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">無効なスレッドです。</main>;
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold">チャット</h1>
      </header>

      <div className="flex-1 overflow-y-auto pt-2">
        {hasMore && (
          <div className="flex justify-center px-4 py-2">
            <button
              type="button"
              onClick={() => loadMore()}
              disabled={loading}
              className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "もっと見る"}
            </button>
          </div>
        )}
        {loading && messages.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary">読み込み中…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary">メッセージはまだありません</p>
        )}
        {/* messages は新→古順なので reverse して古→新で render */}
        <div className="flex flex-col-reverse gap-2 px-4 pb-4">
          {messages.map((m) => {
            const isMine = m.senderId === viewerId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isMine && <Avatar fallback="?" size="sm" />}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? "bg-accent text-white" : "bg-bg-secondary text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className={`mt-1 text-[10px] opacity-70 ${isMine ? "text-white" : "text-text-muted"}`}>
                    {timeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {typingActorId && typingActorId !== viewerId && (
        <p className="px-4 py-1 text-xs text-text-secondary" aria-live="polite">
          入力中…
        </p>
      )}

      <MessageComposer onSend={send} onTyping={sendTyping} />
    </main>
  );
}
