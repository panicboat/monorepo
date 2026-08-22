"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/modules/social";
import { useSuggestedUsers } from "@/modules/discovery/hooks";

export function SuggestedUsersPane() {
  const { profiles, loading } = useSuggestedUsers(10);

  // Hide the pane entirely when there is nothing to suggest.
  if (!loading && profiles.length === 0) return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto px-4 py-4 xl:block">
      <h2 className="px-2 pb-2 text-base font-bold text-text-primary">おすすめユーザー</h2>
      <div className="rounded-2xl bg-surface">
        {loading && profiles.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-secondary">読み込み中…</p>
        )}
        {profiles.map((p) => (
          <div key={p.accountId} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/u/${encodeURIComponent(p.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{p.displayName}</p>
                <p className="truncate text-xs text-text-secondary">@{p.username}</p>
              </div>
            </Link>
            <FollowButton targetAccountId={p.accountId} />
          </div>
        ))}
      </div>
    </aside>
  );
}
