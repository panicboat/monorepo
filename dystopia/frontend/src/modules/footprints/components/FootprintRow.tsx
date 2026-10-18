"use client";

import { EntryCard } from "@/components/ui/entry-card";
import { formatTimeAgo } from "@/lib/utils/date";
import type { FootprintView } from "@/modules/footprints/types";

export interface FootprintRowProps {
  footprint: FootprintView;
}

export function FootprintRow({ footprint }: FootprintRowProps) {
  const { visitor, lastVisitedAt, isUnread, visitCount } = footprint;

  return (
    <EntryCard profile={visitor} meta={lastVisitedAt ? formatTimeAgo(lastVisitedAt) : ""} unread={isUnread}>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-text-primary">あなたのプロフィールを見ました</span>
        {visitCount > 1 && <span className="shrink-0 text-xs text-text-secondary">{visitCount}回訪問</span>}
      </span>
    </EntryCard>
  );
}
