"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useThreads } from "@/modules/messaging";
import type { ThreadView } from "@/modules/messaging/types";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ThreadRow({ thread }: { thread: ThreadView }) {
  const name = thread.counterpart?.displayName || "—";
  const preview = thread.lastMessage?.content || "（メッセージなし）";
  const isUnread = thread.unreadCount > 0;

  return (
    <Link
      href={`/messages/${encodeURIComponent(thread.id)}`}
      className={`flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-bg-secondary ${
        isUnread ? "bg-bg-secondary/30" : ""
      }`}
    >
      <Avatar
        src={thread.counterpart?.avatarUrl || undefined}
        fallback={name.slice(0, 1) || "?"}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${isUnread ? "font-bold text-text-primary" : "text-text-primary"}`}>
            {name}
          </p>
          <span className="shrink-0 text-xs text-text-muted">{timeAgo(thread.lastMessageAt)}</span>
        </div>
        <p className="truncate pt-0.5 text-sm text-text-secondary">{preview}</p>
      </div>
      {isUnread && (
        <span className="ml-2 inline-flex shrink-0 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white">
          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function MessagesPage() {
  const { threads, totalUnreadCount, loading, error } = useThreads();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">メッセージ</h1>
        <p className="pt-1 text-sm text-text-secondary">未読 {totalUnreadCount} 件</p>
      </div>

      {loading && threads.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました</p>}
      {!loading && threads.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">💬</span>
          <p className="pt-3 text-text-primary">メッセージはまだありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            フォロー中の相手の プロフィール からメッセージを送信できます
          </p>
        </div>
      )}

      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
    </main>
  );
}
