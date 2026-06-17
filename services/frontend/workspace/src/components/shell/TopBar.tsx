"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useProfile } from "@/modules/profile/hooks";
import { useUnreadCount } from "@/modules/notifications/hooks";

interface TopBarProps {
  onAvatarClick: () => void;
}

export function TopBar({ onAvatarClick }: TopBarProps) {
  const { profile } = useProfile();
  const { count: unread } = useUnreadCount();
  const avatarUrl = profile?.avatarUrl || undefined;
  const fallback = (profile?.displayName || "?").slice(0, 1);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/95 px-4 py-2 backdrop-blur">
      <button
        type="button"
        onClick={onAvatarClick}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="メニューを開く"
      >
        <Avatar src={avatarUrl} fallback={fallback} size="sm" />
      </button>
      <div aria-hidden="true" />
      <Link
        href="/notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-bg-secondary"
        aria-label={unread > 0 ? `通知 (未読 ${unread})` : "通知"}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-tight text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </header>
  );
}
