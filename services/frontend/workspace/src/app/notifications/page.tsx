"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNotifications, NotificationType } from "@/modules/notifications";
import type { NotificationView } from "@/modules/notifications/types";

function describe(n: NotificationView): string {
  const actorName = n.latestActor?.displayName || "誰か";
  const othersSuffix = n.actorCount > 1 ? ` 他 ${n.actorCount - 1} 人` : "";
  switch (n.type) {
    case NotificationType.LIKE:
      return `${actorName}${othersSuffix} さんがいいねしました`;
    case NotificationType.COMMENT:
      return `${actorName}${othersSuffix} さんがコメントしました`;
    case NotificationType.REPLY:
      return `${actorName}${othersSuffix} さんが返信しました`;
    case NotificationType.FOLLOW_REQUEST:
      return `${actorName} さんからフォロー申請が届きました`;
    case NotificationType.FOLLOW_APPROVED:
      return `${actorName} さんがフォロー承認しました`;
    default:
      return `${actorName} さんから通知`;
  }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP");
}

export default function NotificationsPage() {
  const { notifications, hasMore, unreadCount, loading, loadMore, markRead } = useNotifications();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">通知</h1>
        <p className="pt-1 text-sm text-text-secondary">未読 {unreadCount} 件</p>
      </div>

      {loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {!loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">通知はまだありません。</p>
      )}

      {notifications.map((n) => {
        const isUnread = !n.readAt;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => markRead(n.id)}
            className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left hover:bg-bg-secondary ${
              isUnread ? "bg-bg-secondary/50" : ""
            }`}
          >
            <Avatar
              src={n.latestActor?.avatarUrl || undefined}
              fallback={(n.latestActor?.displayName || "?").slice(0, 1)}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-primary">{describe(n)}</p>
              <p className="text-xs text-text-secondary">{formatDate(n.latestEventAt)}</p>
            </div>
            {isUnread && (
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="未読" />
            )}
          </button>
        );
      })}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
