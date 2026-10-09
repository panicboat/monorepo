import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { SocialProfileView } from "@/modules/social/types";

export { NotificationType };

export interface NotificationView {
  id: string;
  type: NotificationType;
  targetResourceId: string;
  actorCount: number;
  latestActor: SocialProfileView | null;
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
  pushEnabled: boolean;
  post: boolean;
  like: boolean;
  repost: boolean;
  quote: boolean;
  reply: boolean;
  follow: boolean;
  mention: boolean;
  message: boolean;
  oshi: boolean;
  footprintUnreadBadge: boolean;
  footprintsRecordMyVisits: boolean;
}
