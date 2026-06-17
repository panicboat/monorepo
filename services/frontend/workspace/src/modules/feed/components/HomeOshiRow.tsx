"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useFollowList } from "@/modules/social";

export function HomeOshiRow() {
  const { profiles, loading } = useFollowList();

  if (loading && profiles.length === 0) return null;
  if (profiles.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto border-b border-divider px-4 py-3">
      {profiles.map((p) => (
        <Link
          key={p.accountId}
          href={`/u/${encodeURIComponent(p.username)}`}
          className="flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <Avatar
            src={p.avatarUrl || undefined}
            fallback={(p.displayName || "?").slice(0, 1)}
            size="lg"
          />
          <span className="w-full truncate text-center text-xs text-text-secondary">
            {p.displayName || p.username}
          </span>
        </Link>
      ))}
    </div>
  );
}
