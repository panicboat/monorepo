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
  targetPostId: string | null;  // populated for COMMENT/REPLY for deep-link
}

export interface PaginatedNotificationsResponse {
  notifications: NotificationView[];
  nextCursor: string;
  hasMore: boolean;
  unreadCount: number;
}

// Per-account notification preferences (11 booleans).
// `pushEnabled` is the master toggle. The middle 9 fields control per-type
// push delivery. `footprintUnreadBadge` is in-app only (badge visibility).
// Persistence-only in v1; gating is deferred.
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
}
