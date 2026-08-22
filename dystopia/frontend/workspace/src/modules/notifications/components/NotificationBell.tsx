"use client";

import Link from "next/link";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface NotificationBellProps {
  targetAccountId: string;
  className?: string;
}

export function NotificationBell({ targetAccountId, className }: NotificationBellProps) {
  const viewerId = useAuthStore(selectUserId);
  const { count } = useUnreadCount();

  if (!targetAccountId || !viewerId || viewerId !== targetAccountId) return null;

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex items-center justify-center rounded-full p-2 text-xl text-text-primary hover:bg-bg-secondary ${className || ""}`}
      aria-label={count > 0 ? `通知 ${count} 件` : "通知"}
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
