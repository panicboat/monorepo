import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { SocialAccountView } from "@/modules/social/types";

export { NotificationType };

// View shape returned from BFF (mapper-translated from proto Notification)
export interface NotificationView {
  id: string;
  type: NotificationType;
  targetResourceId: string;
  actorCount: number;
  latestActor: SocialAccountView | null;
  latestEventAt: string;  // ISO8601
  readAt: string | null;  // ISO8601 | null = unread
}

export interface PaginatedNotificationsResponse {
  notifications: NotificationView[];
  nextCursor: string;
  hasMore: boolean;
  unreadCount: number;
}
