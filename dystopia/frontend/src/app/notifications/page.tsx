"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useNotifications, describeNotification, notificationHref } from "@/modules/notifications";
import type { NotificationView } from "@/modules/notifications/types";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function NotificationsHeader() {
  return <PageHeader title="通知" description={getFeatureDescription("notifications")} />;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP");
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, hasMore, unreadCount, loading, loadMore, markRead, markAllRead } = useNotifications();

  const handleClick = (n: NotificationView) => {
    if (!n.readAt) {
      markRead(n.id).catch(() => {});
    }
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <NotificationsHeader />
          <p className="pt-1 text-sm text-text-secondary">未読 {unreadCount} 件</p>
        </div>
        <button
          type="button"
          onClick={() => markAllRead().catch(() => {})}
          disabled={unreadCount === 0}
          className="text-sm text-text-secondary underline-offset-2 hover:text-text-primary hover:underline disabled:opacity-40 disabled:no-underline"
        >
          全て既読にする
        </button>
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
            onClick={() => handleClick(n)}
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
              <p className="truncate text-sm text-text-primary">{describeNotification(n)}</p>
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
