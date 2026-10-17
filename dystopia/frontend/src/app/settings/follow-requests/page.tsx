"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { useFollowRequests } from "@/modules/social";

export default function FollowRequestsPage() {
  const { requests, pendingCount, loading, error, approve, reject } = useFollowRequests();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">フォロー申請</h1>
        <p className="pt-1 text-sm text-text-secondary">
          承認待ちの申請 {pendingCount} 件
        </p>
      </div>

      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && requests.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">申請はありません。</p>
      )}

      {requests.map((r) => (
        <div
          key={r.profileId}
          className="flex items-center gap-3 border-b border-border px-4 py-3"
        >
          <Avatar src={r.avatarUrl || undefined} fallback={(r.displayName || r.username).slice(0, 1) || "?"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0"><ProfileName profile={r} /></p>
            <p className="truncate text-sm text-text-secondary">@{r.username}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => approve(r.profileId)}>
              承認
            </Button>
            <Button variant="secondary" size="sm" onClick={() => reject(r.profileId)}>
              拒否
            </Button>
          </div>
        </div>
      ))}
    </main>
  );
}
