"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import type { FootprintView } from "@/modules/footprints/types";

export interface FootprintRowProps {
  footprint: FootprintView;
}

export function FootprintRow({ footprint }: FootprintRowProps) {
  const { visitor, lastVisitedAt, isUnread, visitCount } = footprint;
  const href = visitor.username ? `/u/${encodeURIComponent(visitor.username)}` : "#";

  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-divider px-4 py-3 hover:bg-bg-surface/50"
    >
      {isUnread && (
        <span aria-hidden="true" className="-ml-2 h-12 w-0.5 rounded-full bg-gradient-brand" />
      )}
      <Avatar
        src={visitor.avatarUrl || undefined}
        fallback={(visitor.displayName || "?").slice(0, 1)}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{visitor.displayName || "—"}</p>
        <p className="truncate text-sm text-text-secondary">@{visitor.username || "—"}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-text-muted">
          {lastVisitedAt ? formatTimeAgo(lastVisitedAt) : ""}
        </span>
        {visitCount > 1 && (
          <span className="text-xs text-text-secondary">{visitCount}回訪問</span>
        )}
      </div>
    </Link>
  );
}
