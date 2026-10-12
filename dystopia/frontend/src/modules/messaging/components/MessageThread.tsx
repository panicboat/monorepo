"use client";

import { useEffect, useState } from "react";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useMessages, useThread } from "@/modules/messaging";
import { MessageComposer } from "@/modules/messaging/components/MessageComposer";
import { SendRestrictionNotice } from "@/modules/messaging/components/SendRestrictionNotice";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function MessageThread({ threadId }: { threadId: string }) {
  const { capture } = useViewScope(true, threadId);
  const [readAttempt, setReadAttempt] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const viewerId = useAuthStore(selectActiveProfileId);

  const { messages, hasMore, loading, error, send, markRead, loadMore, refresh } = useMessages(threadId || null);
  const { thread, sendRestriction, loading: threadLoading, error: threadError, refresh: refreshThread } = useThread(threadId || null);
  const counterpart = thread?.counterpart ?? null;
  const counterpartName = counterpart?.displayName || "(退会)";
  const counterpartAvatar = (
    <Avatar src={counterpart?.avatarUrl || undefined} fallback={counterpartName.slice(0, 1)} size="sm" />
  );

  const incomingId = messages.find((message) => message.senderProfileId !== viewerId)?.id;
  useEffect(() => {
    if (!incomingId) return;
    const view = capture();
    void markRead(incomingId).then(
      () => { if (view.isCurrent()) setReadError(null); },
      () => { if (view.isCurrent()) setReadError("既読を更新できませんでした"); }
    );
  }, [incomingId, capture, markRead, readAttempt]);

  if (!threadId) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">無効なスレッドです。</main>;
  }

  return (
    <main className="mx-auto flex h-full max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        {threadLoading ? (
          <h1 className="text-base font-bold">チャット</h1>
        ) : counterpart ? (
          <Link href={`/u/${encodeURIComponent(counterpart.username)}`} className="flex items-center gap-2">
            {counterpartAvatar}
            <h1 className="truncate text-base font-bold">{counterpartName}</h1>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            {counterpartAvatar}
            <h1 className="truncate text-base font-bold">{counterpartName}</h1>
          </div>
        )}
      </header>

      {readError && <div role="alert" className="px-4 py-2 text-sm text-error">{readError}<Button variant="secondary" size="sm" onClick={() => setReadAttempt((attempt) => attempt + 1)}>再試行</Button></div>}
      {(error || threadError) && <div role="alert" className="px-4 py-3 text-sm text-error">メッセージを取得できませんでした<Button variant="secondary" size="sm" onClick={() => { void refresh(); void refreshThread(); }}>再試行</Button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto pt-2">
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
        {!loading && !error && messages.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary">メッセージはまだありません</p>
        )}
        <div className="flex flex-col-reverse gap-2 px-4 pb-4">
          {messages.map((m) => {
            const isMine = m.senderProfileId === viewerId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isMine && counterpartAvatar}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? "bg-accent text-white" : "bg-bg-secondary text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-1 text-xs opacity-70 ${isMine ? "text-white" : "text-text-muted"}`}>
                    {timeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sendRestriction === "none" ? (
        <MessageComposer key={threadId} onSend={send} disabled={threadLoading || !!threadError} />
      ) : (
        <SendRestrictionNotice restriction={sendRestriction} counterpartUsername={counterpart?.username} />
      )}
    </main>
  );
}
