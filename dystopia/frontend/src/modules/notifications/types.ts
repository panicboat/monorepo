import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { ProfileSummaryView } from "@/modules/profile/types";

export { NotificationType };

export interface NotificationView {
  id: string;
  type: NotificationType;
  targetResourceId: string;
  actorCount: number;
  latestActor: ProfileSummaryView | null;
  latestEventAt: string;
  readAt: string | null;
  targetPostId: string | null;
}

export interface PaginatedNotificationsResponse {
  notifications: NotificationView[];
  nextCursor: string;
  hasMore: boolean;
  unreadCount: number;
}

export interface NotificationPreferences {
  comment: boolean;
  like: boolean;
  reply: boolean;
  follow: boolean;
  mention: boolean;
  message: boolean;
  footprintUnreadBadge: boolean;
  footprintsRecordMyVisits: boolean;
}
