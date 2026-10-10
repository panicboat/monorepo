"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

interface NotificationBellProps {
  targetProfileId: string;
  className?: string;
}

export function NotificationBell({ targetProfileId, className }: NotificationBellProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { count } = useUnreadCount();

  if (!targetProfileId || !viewerId || viewerId !== targetProfileId) return null;

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex items-center justify-center rounded-full p-2 text-text-primary hover:bg-bg-secondary ${className || ""}`}
      aria-label={count > 0 ? `通知 ${count} 件` : "通知"}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
