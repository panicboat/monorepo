import * as React from "react";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface UserCardProps {
  name: string;
  handle: string;
  avatarSrc?: string;
  following?: boolean;
  onFollow?: () => void;
  className?: string;
}

export function UserCard({
  name,
  handle,
  avatarSrc,
  following,
  onFollow,
  className,
}: UserCardProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar src={avatarSrc} fallback={name.slice(0, 1)} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{name}</p>
        <p className="truncate text-sm text-text-secondary">@{handle}</p>
      </div>
      {onFollow && (
        <Button
          variant={following ? "secondary" : "primary"}
          size="sm"
          onClick={onFollow}
        >
          {following ? "フォロー中" : "フォロー"}
        </Button>
      )}
    </div>
  );
}
