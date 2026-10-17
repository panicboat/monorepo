import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { NotificationView } from "../types";

export function describeNotificationAction(n: NotificationView): string {
  const others = n.actorCount > 1 ? `他 ${n.actorCount - 1} 人 ` : "";
  switch (n.type) {
    case NotificationType.LIKE:
      return `${others}さんがいいねしました`;
    case NotificationType.COMMENT:
      return `${others}さんがコメントしました`;
    case NotificationType.REPLY:
      return `${others}さんが返信しました`;
    case NotificationType.FOLLOW_REQUEST:
      return "さんからフォロー申請が届きました";
    case NotificationType.FOLLOW_APPROVED:
      return "さんにフォローされました";
    case NotificationType.MENTION:
      return `${others}さんがメンションしました`;
    default:
      return "さんから通知";
  }
}

export function notificationHref(n: NotificationView): string | null {
  switch (n.type) {
    case NotificationType.LIKE:
      return `/posts/${encodeURIComponent(n.targetResourceId)}`;
    case NotificationType.COMMENT:
    case NotificationType.REPLY:
    case NotificationType.MENTION:
      // Use targetPostId because comment notifications store the comment ID as targetResourceId.
      return n.targetPostId ? `/posts/${encodeURIComponent(n.targetPostId)}` : null;
    case NotificationType.FOLLOW_REQUEST:
      return "/settings/follow-requests";
    case NotificationType.FOLLOW_APPROVED:
      return n.latestActor?.username
        ? `/u/${encodeURIComponent(n.latestActor.username)}`
        : null;
    default:
      return null;
  }
}
