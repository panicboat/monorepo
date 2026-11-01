import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { NotificationView } from "../types";

export function describeNotificationAction(n: NotificationView): string {
  const others = n.actorCount > 1 ? `ほか ${n.actorCount - 1} 人も` : "";
  switch (n.type) {
    case NotificationType.LIKE:
      return `${others}あなたの投稿にいいねしました`;
    case NotificationType.COMMENT:
      return `${others}あなたの投稿にコメントしました`;
    case NotificationType.REPLY:
      return `${others}あなたのコメントに返信しました`;
    case NotificationType.FOLLOW_REQUEST:
      return "フォロー申請が届きました";
    case NotificationType.FOLLOW:
      return "あなたをフォローしました";
    case NotificationType.MENTION:
      return `${others}あなたをメンションしました`;
    case NotificationType.QUOTE:
      return `${others}あなたの投稿を引用しました`;
    default:
      return "お知らせがあります";
  }
}

export function notificationHref(n: NotificationView, ownUsername: string | null): string | null {
  switch (n.type) {
    case NotificationType.LIKE:
      return `/posts/${encodeURIComponent(n.targetResourceId)}`;
    case NotificationType.COMMENT:
    case NotificationType.REPLY:
    case NotificationType.MENTION:
      // Use targetPostId because comment notifications store the comment ID as targetResourceId.
      return n.targetPostId ? `/posts/${encodeURIComponent(n.targetPostId)}` : null;
    case NotificationType.QUOTE:
      return n.targetPostId ? `/posts/${encodeURIComponent(n.targetPostId)}?tab=quotes` : null;
    case NotificationType.FOLLOW_REQUEST:
      return ownUsername ? `/u/${encodeURIComponent(ownUsername)}/requests` : null;
    case NotificationType.FOLLOW:
      return n.latestActor?.username
        ? `/u/${encodeURIComponent(n.latestActor.username)}`
        : null;
    default:
      return null;
  }
}
