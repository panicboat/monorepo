"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { useBlockedList } from "../hooks/useBlockedList";
import { BlockButton } from "./BlockButton";

export function BlockedAccountsList() {
  const { profiles, loading, loadingMore, error, hasMore, loadMore } = useBlockedList();

  return (
    <div>
      <p className="px-4 pt-1 text-sm text-text-secondary">ブロック中のアカウント</p>
      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && profiles.length === 0 && <p className="px-4 py-6 text-text-secondary">ブロック中のアカウントはありません。</p>}
      {profiles.map((p) => (
        <div key={p.profileId} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex">
              <ProfileName profile={p} />
            </p>
            <p className="truncate text-sm text-text-secondary">@{p.username}</p>
          </div>
          <BlockButton targetProfileId={p.profileId} />
        </div>
      ))}
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
