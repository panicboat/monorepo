"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useThreads } from "@/modules/messaging";
import type { ThreadView } from "@/modules/messaging/types";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function MessagesHeader() {
  return <PageHeader title="メッセージ" description={getFeatureDescription("messages")} />;
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ThreadRow({ thread }: { thread: ThreadView }) {
  const name = thread.counterpart?.displayName || "(退会)";
  const preview = thread.lastMessage?.content || "メッセージはまだありません";
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
      <ChevronRight className="size-5 shrink-0 text-text-secondary" aria-hidden="true" />
    </Link>
  );
}

export default function MessagesPage() {
  const { threads, totalUnreadCount, loading, error } = useThreads();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<{ session: number; open: boolean } | null>(null);

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <MessagesHeader />
        <p className="pt-1 text-sm text-text-secondary">未読 {totalUnreadCount} 件</p>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
        >
          ＋ 新しいメッセージ
        </Button>
      </div>

      {loading && threads.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました</p>}
      {!loading && threads.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <Mail className="size-10 text-text-secondary" strokeWidth={1.5} />
          <p className="pt-3 text-text-primary">メッセージはまだありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            フォロー中の相手の プロフィール からメッセージを送信できます
          </p>
        </div>
      )}

      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="message"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </main>
  );
}
