"use client";

import { Avatar } from "@/components/ui/avatar";
import { useProfile } from "@/modules/profile/hooks";

interface TopBarProps {
  onAvatarClick: () => void;
}

export function TopBar({ onAvatarClick }: TopBarProps) {
  const { profile } = useProfile();
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
      <div className="w-8" aria-hidden="true" />
    </header>
  );
}
