"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName, profileDisplayName } from "@/components/ui/profile-name";
import { useFollowRequests } from "../hooks/useFollowRequests";

export function FollowRequestsList() {
  const { requests, pendingCount, loading, error, approve, reject } = useFollowRequests();

  return (
    <div>
      <p className="px-4 pt-1 text-sm text-text-secondary">承認待ちの申請 {pendingCount} 件</p>
      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && requests.length === 0 && <p className="px-4 py-6 text-text-secondary">申請はありません。</p>}
      {requests.map((r) => {
        const href = r.username ? `/u/${encodeURIComponent(r.username)}` : undefined;
        return (
          <div key={r.profileId} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar src={r.avatarUrl || undefined} fallback={profileDisplayName(r).replace("@", "").slice(0, 1) || "?"} size="md" href={href} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0">
                <ProfileName profile={r} link />
              </p>
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
        );
      })}
    </div>
  );
}
