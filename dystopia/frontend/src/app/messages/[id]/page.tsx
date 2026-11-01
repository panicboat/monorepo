"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ProfileName } from "@/components/ui/profile-name";
import { useMessages, useThread } from "@/modules/messaging";
import { MessageComposer } from "@/modules/messaging/components/MessageComposer";
import { SendRestrictionNotice } from "@/modules/messaging/components/SendRestrictionNotice";
import { ReportButton } from "@/modules/report";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const threadId = typeof params.id === "string" ? params.id : "";
  const viewerId = useAuthStore(selectActiveProfileId);

  const { messages, hasMore, loading, send, markRead, loadMore } = useMessages(threadId || null);
  const { thread, sendRestriction, loading: threadLoading } = useThread(threadId || null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const counterpart = thread?.counterpart ?? null;
  const counterpartAvatar = (
    <Avatar src={counterpart?.avatarUrl || undefined} fallback={(counterpart?.displayName || "?").slice(0, 1)} size="sm" />
  );

  useEffect(() => {
    const incoming = messages.find((m) => m.senderProfileId !== viewerId);
    if (incoming) {
      markRead(incoming.id);
    }
  }, [messages, viewerId, markRead]);

  const sendAndShowLatest = useCallback(
    async (content: string) => {
      await send(content);
      // A column-reverse scroller measures scrollTop from the bottom, so 0 is the latest message.
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    },
    [send]
  );

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
            <h1 className="flex min-w-0 items-center text-base font-bold">
              <ProfileName profile={counterpart} className="text-base" />
              <span className="shrink-0">とのメッセージ</span>
            </h1>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            {counterpartAvatar}
            <h1 className="flex min-w-0 items-center text-base font-bold">
              <ProfileName profile={counterpart} className="text-base" />
              <span className="shrink-0">とのメッセージ</span>
            </h1>
          </div>
        )}
        <p role="note" className="mt-2 text-xs text-text-secondary">
          当DMでの直接の金銭交渉・店舗を介さない直接取引（裏引き）は固く禁じます。
        </p>
      </header>

      <div ref={scrollerRef} className="flex flex-1 flex-col-reverse overflow-y-auto pt-2">
        <div>
          {hasMore && (
            // Chrome's scroll anchoring would follow this button to the new top and skip the page it just loaded.
            <div className="flex justify-center px-4 py-2 [overflow-anchor:none]">
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
                      isMine ? "bg-accent text-white" : "bg-surface text-text-primary"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`mt-1 text-xs opacity-70 ${isMine ? "text-white" : "text-text-muted"}`}>
                      {timeAgo(m.createdAt)}
                    </p>
                  </div>
                  {!isMine && (
                    <ReportButton targetType="message" targetId={m.id} label="通報" className="shrink-0 text-xs text-text-muted hover:text-text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {sendRestriction === "none" ? (
        <MessageComposer onSend={sendAndShowLatest} />
      ) : (
        <SendRestrictionNotice restriction={sendRestriction} counterpartUsername={counterpart?.username} />
      )}
    </main>
  );
}
