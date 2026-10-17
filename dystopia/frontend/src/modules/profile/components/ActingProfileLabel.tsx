"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useProfile } from "@/modules/profile/hooks";

export function ActingProfileLabel({ className }: { className?: string }) {
  const { profile } = useProfile();

  if (!profile) return null;

  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-sm text-text-secondary", className)}>
      <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="sm" />
      <span className="truncate font-bold text-text-primary">{profile.displayName || "—"}</span>
      <span className="truncate">@{profile.username || "—"}</span>
      <span className="shrink-0">として</span>
    </div>
  );
}
