"use client";

import { useState } from "react";
import { ChevronRight, Mail } from "lucide-react";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EntryCard } from "@/components/ui/entry-card";
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

export function ThreadRow({ thread }: { thread: ThreadView }) {
  const preview = thread.lastMessage?.content || "メッセージはまだありません";
  const isUnread = thread.unreadCount > 0;

  return (
    <EntryCard
      profile={thread.counterpart}
      meta={timeAgo(thread.lastMessageAt)}
      unread={isUnread}
      href={`/messages/${encodeURIComponent(thread.id)}`}
    >
      <span className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-sm ${isUnread ? "text-text-primary" : "text-text-secondary"}`}>{preview}</span>
        {isUnread && (
          <span className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white">
            {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
          </span>
        )}
        <ChevronRight className="size-5 shrink-0 text-text-secondary" aria-hidden="true" />
      </span>
    </EntryCard>
  );
}

export default function MessagesPage() {
  const { threads, totalUnreadCount, loading, loadingMore, error, hasMore, loadMore } = useThreads();
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
      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loadingMore}>
            もっと見る
          </Button>
        </div>
      )}
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
