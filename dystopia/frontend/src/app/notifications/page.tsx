"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EntryCard } from "@/components/ui/entry-card";
import { useNotifications, describeNotificationAction, notificationHref } from "@/modules/notifications";
import type { NotificationView } from "@/modules/notifications/types";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";
import { useProfile } from "@/modules/profile/hooks";
import { toastOnFailure } from "@/stores/toastStore";

export function NotificationsHeader() {
  return <PageHeader title="通知" description={getFeatureDescription("notifications")} />;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP");
}

export function NotificationsActions({ unreadCount, onMarkAllRead }: { unreadCount: number; onMarkAllRead: () => void }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <Link href="/settings/notifications" className="text-sm text-text-secondary underline-offset-2 hover:text-text-primary hover:underline">
        通知設定
      </Link>
      <button
        type="button"
        onClick={onMarkAllRead}
        disabled={unreadCount === 0}
        className="text-sm text-text-secondary underline-offset-2 hover:text-text-primary hover:underline disabled:opacity-40 disabled:no-underline"
      >
        全て既読にする
      </button>
    </div>
  );
}

export function NotificationRow({ notification: n, onClick }: { notification: NotificationView; onClick: () => void }) {
  return (
    <EntryCard profile={n.latestActor} meta={formatDate(n.latestEventAt)} unread={!n.readAt} onClick={onClick}>
      <span className="block text-sm text-text-primary">{describeNotificationAction(n)}</span>
    </EntryCard>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, hasMore, unreadCount, loading, loadMore, markRead, markAllRead } = useNotifications();
  const { profile } = useProfile();

  const handleClick = (n: NotificationView) => {
    if (!n.readAt) {
      markRead(n.id).catch(() => {});
    }
    const href = notificationHref(n, profile?.username || null);
    if (href) router.push(href);
  };

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <NotificationsHeader />
          <p className="pt-1 text-sm text-text-secondary">未読 {unreadCount} 件</p>
        </div>
        <NotificationsActions unreadCount={unreadCount} onMarkAllRead={() => markAllRead().catch(toastOnFailure("既読にできませんでした"))} />
      </div>

      {loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {!loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">通知はまだありません。</p>
      )}

      {notifications.map((n) => (
        <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />
      ))}

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
