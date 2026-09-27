import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { NotificationView } from "../types";

// FOLLOW_APPROVED covers both a plain follow and an approved request; worded for the (far more common) former.
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
    default:
      return `${actorName} さんから通知`;
  }
}

// COMMENT/REPLY route via targetPostId; target_resource_id is actually the comment_id here.
export function notificationHref(n: NotificationView): string | null {
  switch (n.type) {
    case NotificationType.LIKE:
      return `/posts/${encodeURIComponent(n.targetResourceId)}`;
    case NotificationType.COMMENT:
    case NotificationType.REPLY:
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
