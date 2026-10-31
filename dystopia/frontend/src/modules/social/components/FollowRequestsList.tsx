"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName, profileInitial } from "@/components/ui/profile-name";
import { useFollowRequests } from "../hooks/useFollowRequests";
import { toastOnFailure } from "@/stores/toastStore";

export function FollowRequestsList() {
  const { requests, pendingCount, loading, loadingMore, error, approve, reject, approveAll, hasMore, loadMore } = useFollowRequests();

  const onApproveAll = async () => {
    if (!confirm(`${pendingCount} 件の申請をすべて承認しますか？`)) return;
    await approveAll().catch(toastOnFailure("フォロー申請を承認できませんでした"));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 pt-1">
        <p className="text-sm text-text-secondary">承認待ちの申請 {pendingCount} 件</p>
        {requests.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void onApproveAll()}>
            すべて承認
          </Button>
        )}
      </div>
      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && requests.length === 0 && <p className="px-4 py-6 text-text-secondary">申請はありません。</p>}
      {requests.map((r) => {
        const href = r.username ? `/u/${encodeURIComponent(r.username)}` : undefined;
        return (
          <div key={r.profileId} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar src={r.avatarUrl || undefined} fallback={profileInitial(r)} size="md" href={href} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0">
                <ProfileName profile={r} link />
              </p>
              <p className="truncate text-sm text-text-secondary">@{r.username}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => void approve(r.profileId).catch(toastOnFailure("フォロー申請を承認できませんでした"))}>
                承認
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void reject(r.profileId).catch(toastOnFailure("フォロー申請を拒否できませんでした"))}>
                拒否
              </Button>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loadingMore}>
            もっと見る
          </Button>
        </div>
      )}
    </div>
  );
}
