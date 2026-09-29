import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { NotificationView } from "../types";

export function describeNotification(n: NotificationView): string {
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
      return `${actorName} さんにフォローされました`;
    case NotificationType.MENTION:
      return `${actorName}${othersSuffix} さんがメンションしました`;
    default:
      return `${actorName} さんから通知`;
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
