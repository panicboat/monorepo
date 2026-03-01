"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "./Button";
import { Loader2 } from "lucide-react";

export interface UserListItem {
  id: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

interface UserListCardProps {
  user: UserListItem;
  href?: string;
  actionLabel: string;
  actionLoadingLabel?: string;
  isLoading?: boolean;
  onAction: (userId: string) => void;
}

export function UserListCard({
  user,
  href,
  actionLabel,
  actionLoadingLabel,
  isLoading = false,
  onAction,
}: UserListCardProps) {
  const AvatarContent = (
    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-surface-tertiary flex-shrink-0">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-text-muted">
          <Users size={20} />
        </div>
      )}
    </div>
  );

  const InfoContent = (
    <div className="flex-1 min-w-0">
      <p className="font-medium text-text-primary truncate">{user.name}</p>
      {user.subtitle && (
        <p className="text-xs text-text-muted">{user.subtitle}</p>
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-surface shadow-sm border border-border"
    >
      {href ? (
        <Link href={href} className="contents">
          {AvatarContent}
        </Link>
      ) : (
        AvatarContent
      )}

      {href ? (
        <Link href={href} className="flex-1 min-w-0">
          {InfoContent}
        </Link>
      ) : (
        InfoContent
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => onAction(user.id)}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          actionLabel
        )}
      </Button>
    </motion.div>
  );
}
