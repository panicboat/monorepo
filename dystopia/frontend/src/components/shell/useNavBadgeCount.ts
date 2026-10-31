"use client";

import { useNotificationPreferences, useUnreadCount } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useFootprintsUnreadCount } from "@/modules/footprints";
import type { NavBadgeKey } from "./resolveNavItems";

export function useNavBadgeCount(): (key: NavBadgeKey | undefined) => number {
  const { count: unread } = useUnreadCount();
  const { count: msgUnread } = useTotalUnread();
  const { count: footprintsUnread } = useFootprintsUnreadCount();
  const { preferences } = useNotificationPreferences();
  const footprintsBadgeEnabled = preferences?.footprintUnreadBadge !== false;

  return (key) => {
    if (key === "unread") return unread;
    if (key === "messaging_unread") return msgUnread;
    if (key === "footprints_unread") return footprintsBadgeEnabled ? footprintsUnread : 0;
    return 0;
  };
}
